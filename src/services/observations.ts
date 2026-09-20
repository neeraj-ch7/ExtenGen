import crypto from 'crypto';
import { Observation, ScoredObservation, TenantContext, ObservationSource, ObservationMetadata } from '../db/schema.js';
import { getDbPool, withTenantContext } from '../db/client.js';
import { generateEmbedding, calculateCosineSimilarity } from './embeddings.js';
import { enqueueEmbeddingJob, registerDirectUpdateCallback } from './queue.js';

// In-Memory fallback store for tests, offline development, or environments without PostgreSQL
const memoryStore: Map<string, Observation> = new Map();

// Register callback for in-memory direct updates
registerDirectUpdateCallback(async (observationId, embedding) => {
  const obs = memoryStore.get(observationId);
  if (obs) {
    obs.embedding = embedding;
    obs.status = 'indexed';
    obs.updated_at = new Date().toISOString();
  }
});

export interface StoreObservationInput {
  content: string;
  title?: string;
  source?: ObservationSource;
  tags?: string[];
  metadata?: ObservationMetadata;
  immediateEmbed?: boolean; // Useful in tests or sync runs
}

export interface RecallContextInput {
  query: string;
  limit?: number;
  similarityThreshold?: number;
  sources?: string[];
  tags?: string[];
}

export interface RecallResult {
  query: string;
  matchesCount: number;
  observations: ScoredObservation[];
  formattedContext: string;
}

/**
 * Capture and store an observation with tenant isolation.
 */
export async function storeObservation(
  tenant: TenantContext,
  input: StoreObservationInput
): Promise<Observation> {
  if (!input.content || input.content.trim().length === 0) {
    throw new Error('Observation content cannot be empty.');
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const source = input.source || 'agent_session';
  const metadata: ObservationMetadata = {
    ...(input.metadata || {}),
    ...(input.tags ? { tags: input.tags } : {}),
  };

  const pool = getDbPool();

  let observation: Observation = {
    id,
    org_id: tenant.orgId,
    user_id: tenant.userId || null,
    source,
    title: input.title || null,
    content: input.content.trim(),
    metadata,
    embedding: null,
    status: 'pending_embedding',
    created_at: now,
    updated_at: now,
  };

  if (pool) {
    await withTenantContext(tenant, async (client) => {
      const result = await client.query(
        `INSERT INTO observations (id, org_id, user_id, source, title, content, metadata, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, org_id, user_id, source, title, content, metadata, embedding, status, created_at, updated_at`,
        [
          id,
          tenant.orgId,
          tenant.userId || null,
          source,
          input.title || null,
          input.content.trim(),
          JSON.stringify(metadata),
          'pending_embedding',
          now,
          now,
        ]
      );
      observation = result.rows[0];
    });
  } else {
    memoryStore.set(id, observation);
  }

  // Prepare full text representation including title and tags for comprehensive semantic recall
  const textToEmbed = [
    input.title ? `Title: ${input.title}` : '',
    input.content,
    input.tags && input.tags.length > 0 ? `Tags: ${input.tags.join(', ')}` : '',
  ].filter(Boolean).join('\n\n');

  // If immediate embedding requested (e.g. for synchronous tests or scripts)
  if (input.immediateEmbed) {
    const embedding = await generateEmbedding(textToEmbed);
    observation.embedding = embedding;
    observation.status = 'indexed';

    if (pool) {
      await withTenantContext(tenant, async (client) => {
        const vectorLiteral = `[${embedding.join(',')}]`;
        await client.query(
          `UPDATE observations 
           SET embedding = $1::vector, status = 'indexed', updated_at = now() 
           WHERE id = $2 AND org_id = $3`,
          [vectorLiteral, id, tenant.orgId]
        );
      });
    } else {
      memoryStore.set(id, observation);
    }
  } else {
    // Dispatch asynchronous embedding job via BullMQ / in-memory worker
    await enqueueEmbeddingJob({
      observationId: id,
      content: textToEmbed,
      orgId: tenant.orgId,
    });
  }

  return observation;
}

/**
 * Retrieve top-k relevant observations matching query via vector similarity search,
 * strictly filtered by the caller's org_id.
 */
export async function recallContext(
  tenant: TenantContext,
  input: RecallContextInput
): Promise<RecallResult> {
  const {
    query,
    limit = 5,
    similarityThreshold = 0.50,
    sources,
    tags,
  } = input;

  if (!query || query.trim().length === 0) {
    return {
      query: '',
      matchesCount: 0,
      observations: [],
      formattedContext: 'No relevant context found (empty query).',
    };
  }

  // 1. Generate embedding for search query
  const queryEmbedding = await generateEmbedding(query);
  const pool = getDbPool();
  let matches: ScoredObservation[] = [];

  if (pool) {
    await withTenantContext(tenant, async (client) => {
      const vectorLiteral = `[${queryEmbedding.join(',')}]`;
      
      let sql = `
        SELECT id, org_id, user_id, source, title, content, metadata, created_at, updated_at,
               (1 - (embedding <=> $1::vector)) AS similarity
        FROM observations
        WHERE org_id = $2
          AND embedding IS NOT NULL
          AND status = 'indexed'
          AND (1 - (embedding <=> $1::vector)) >= $3
      `;
      const params: (string | number | string[])[] = [vectorLiteral, tenant.orgId, similarityThreshold];

      if (sources && sources.length > 0) {
        params.push(sources);
        sql += ` AND source = ANY($${params.length})`;
      }

      sql += ` ORDER BY embedding <=> $1::vector ASC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await client.query(sql, params);
      matches = result.rows.map(row => ({
        ...row,
        similarity: parseFloat(row.similarity),
      }));
    });
  } else {
    // In-memory vector similarity search
    const allOrgObservations = Array.from(memoryStore.values()).filter(
      obs => obs.org_id === tenant.orgId && obs.embedding && obs.embedding.length > 0
    );

    const scored: ScoredObservation[] = [];
    for (const obs of allOrgObservations) {
      if (sources && sources.length > 0 && !sources.includes(obs.source)) {
        continue;
      }
      if (tags && tags.length > 0) {
        const obsTags = (obs.metadata?.tags as string[]) || [];
        const hasTag = tags.some(t => obsTags.includes(t));
        if (!hasTag) continue;
      }

      const sim = calculateCosineSimilarity(queryEmbedding, obs.embedding!);
      if (sim >= similarityThreshold) {
        scored.push({
          ...obs,
          similarity: sim,
        });
      }
    }

    scored.sort((a, b) => b.similarity - a.similarity);
    matches = scored.slice(0, limit);
  }

  const formattedContext = formatContextForInjection(matches);

  return {
    query,
    matchesCount: matches.length,
    observations: matches,
    formattedContext,
  };
}

/**
 * Format retrieved observations into prompt-injectable Markdown.
 */
export function formatContextForInjection(matches: ScoredObservation[]): string {
  if (matches.length === 0) {
    return 'No prior relevant context or decisions found in memory.';
  }

  const header = `### 🧠 ExtenGen Shared Memory (${matches.length} relevant observation${matches.length > 1 ? 's' : ''} retrieved):\n`;
  
  const entries = matches.map((obs, idx) => {
    const similarityPercent = Math.round(obs.similarity * 100);
    const title = obs.title ? ` — ${obs.title}` : '';
    const date = new Date(obs.created_at).toISOString().split('T')[0];
    const tags = obs.metadata?.tags && Array.isArray(obs.metadata.tags)
      ? ` [Tags: ${obs.metadata.tags.join(', ')}]`
      : '';
    const sourceInfo = `[Source: ${obs.source}${tags} | Relevance: ${similarityPercent}% | Date: ${date}]`;

    return `#### Observation ${idx + 1}${title}\n${sourceInfo}\n\`\`\`text\n${obs.content}\n\`\`\``;
  }).join('\n\n');

  return `${header}\n${entries}\n\n*Use the above context to inform your architectural decisions and code changes consistently with past team work.*`;
}

/**
 * List recent observations for a tenant
 */
export async function listObservations(
  tenant: TenantContext,
  limit = 20,
  source?: string
): Promise<Observation[]> {
  const pool = getDbPool();

  if (pool) {
    return await withTenantContext(tenant, async (client) => {
      let sql = `SELECT * FROM observations WHERE org_id = $1`;
      const params: (string | number)[] = [tenant.orgId];

      if (source) {
        params.push(source);
        sql += ` AND source = $2`;
      }

      sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await client.query(sql, params);
      return result.rows;
    });
  }

  const results = Array.from(memoryStore.values())
    .filter(obs => obs.org_id === tenant.orgId && (!source || obs.source === source))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  return results;
}

/**
 * Clear in-memory store (used for tests)
 */
export function clearMemoryStore(): void {
  memoryStore.clear();
}
