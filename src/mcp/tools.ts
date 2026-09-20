import { z } from 'zod';
import { TenantContext } from '../db/schema.js';
import { storeObservation, recallContext, listObservations } from '../services/observations.js';
import { ingestGitHubRepo, fetchAndIngestFromGitHubAPI } from '../services/github.js';

export const StoreObservationSchema = {
  content: z.string().min(1).describe('The text of the observation, decision, design pattern, bug fix, or architecture note to store in shared memory.'),
  title: z.string().optional().describe('Short descriptive title for this observation.'),
  source: z.string().optional().default('agent_session').describe('Source of the observation (e.g. agent_session, manual, documentation).'),
  tags: z.array(z.string()).optional().describe('List of tags/keywords for filtering (e.g. ["database", "auth", "billing"]).'),
  metadata: z.record(z.unknown()).optional().describe('Arbitrary structured metadata (e.g. file paths, commit hashes, session ID).'),
};

export const RecallContextSchema = {
  query: z.string().min(1).describe('The semantic search query, question, or task description to find relevant prior memories and decisions for.'),
  limit: z.number().int().min(1).max(20).optional().default(5).describe('Maximum number of relevant observations to recall.'),
  similarity_threshold: z.number().min(0).max(1).optional().default(0.50).describe('Minimum cosine similarity threshold (0.0 to 1.0).'),
  sources: z.array(z.string()).optional().describe('Optional list of sources to filter by (e.g. ["agent_session", "github_commit"]).'),
  tags: z.array(z.string()).optional().describe('Optional list of tags to filter by.'),
};

export const ListObservationsSchema = {
  limit: z.number().int().min(1).max(50).optional().default(10).describe('Number of recent observations to return.'),
  source: z.string().optional().describe('Filter by observation source.'),
};

export const IngestGitHubSchema = {
  repo: z.string().describe('GitHub repository name (e.g. "owner/repo").'),
  token: z.string().optional().describe('GitHub personal access token for fetching from GitHub API.'),
  limit: z.number().int().min(1).max(30).optional().default(10).describe('Number of recent commits/PRs to fetch.'),
};

/**
 * Handle store_observation tool invocation
 */
export async function handleStoreObservation(
  tenant: TenantContext,
  args: z.input<z.ZodObject<typeof StoreObservationSchema>>
) {
  const result = await storeObservation(tenant, {
    content: args.content,
    title: args.title,
    source: args.source,
    tags: args.tags,
    metadata: args.metadata,
  });

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            success: true,
            message: 'Observation captured and queued for semantic embedding.',
            observation: {
              id: result.id,
              org_id: result.org_id,
              source: result.source,
              title: result.title,
              created_at: result.created_at,
              status: result.status,
            },
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Handle recall_context tool invocation
 */
export async function handleRecallContext(
  tenant: TenantContext,
  args: z.input<z.ZodObject<typeof RecallContextSchema>>
) {
  const result = await recallContext(tenant, {
    query: args.query,
    limit: args.limit,
    similarityThreshold: args.similarity_threshold,
    sources: args.sources,
    tags: args.tags,
  });

  return {
    content: [
      {
        type: 'text' as const,
        text: result.formattedContext,
      },
    ],
    // Also include structured data for programmatic access
    _meta: {
      query: result.query,
      matchesCount: result.matchesCount,
      observations: result.observations.map(o => ({
        id: o.id,
        title: o.title,
        source: o.source,
        similarity: o.similarity,
        created_at: o.created_at,
      })),
    },
  };
}

/**
 * Handle list_observations tool invocation
 */
export async function handleListObservations(
  tenant: TenantContext,
  args: z.input<z.ZodObject<typeof ListObservationsSchema>>
) {
  const observations = await listObservations(tenant, args.limit, args.source);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            count: observations.length,
            observations: observations.map(o => ({
              id: o.id,
              title: o.title,
              source: o.source,
              content: o.content.slice(0, 150) + (o.content.length > 150 ? '...' : ''),
              status: o.status,
              created_at: o.created_at,
              metadata: o.metadata,
            })),
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Handle ingest_github tool invocation
 */
export async function handleIngestGitHub(
  tenant: TenantContext,
  args: z.input<z.ZodObject<typeof IngestGitHubSchema>>
) {
  const result = await fetchAndIngestFromGitHubAPI(tenant, args.repo, args.token, args.limit);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            success: true,
            repo: args.repo,
            ingestedCommits: result.ingestedCommits,
            ingestedPRs: result.ingestedPRs,
            totalIngested: result.observationIds.length,
          },
          null,
          2
        ),
      },
    ],
  };
}
