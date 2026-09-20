import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { generateEmbedding } from './embeddings.js';
import { getDbPool, withTenantContext } from '../db/client.js';

export interface EmbedJobData {
  observationId: string;
  content: string;
  orgId: string;
}

const QUEUE_NAME = 'observation-embedding-queue';

let redisConnection: Redis | null = null;
let embedQueue: Queue<EmbedJobData> | null = null;
let embedWorker: Worker<EmbedJobData> | null = null;

// Direct / in-memory processor callback
export type DirectUpdateCallback = (observationId: string, embedding: number[]) => Promise<void>;
let directUpdateCallback: DirectUpdateCallback | null = null;

export function registerDirectUpdateCallback(cb: DirectUpdateCallback): void {
  directUpdateCallback = cb;
}

/**
 * Initialize Redis and BullMQ Queue/Worker if REDIS_URL is provided.
 */
export function initQueue(): { queue: Queue<EmbedJobData> | null; worker: Worker<EmbedJobData> | null } {
  if (!env.REDIS_URL) {
    return { queue: null, worker: null };
  }

  if (embedQueue && embedWorker) {
    return { queue: embedQueue, worker: embedWorker };
  }

  try {
    redisConnection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });

    embedQueue = new Queue<EmbedJobData>(QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });

    embedWorker = new Worker<EmbedJobData>(
      QUEUE_NAME,
      async (job: Job<EmbedJobData>) => {
        await processEmbedJob(job.data);
      },
      { connection: redisConnection, concurrency: 5 }
    );

    embedWorker.on('completed', (job) => {
      // Completed job
    });

    embedWorker.on('failed', (job, err) => {
      console.error(`❌ Embedding job failed for observation ${job?.data.observationId}:`, err);
    });

    return { queue: embedQueue, worker: embedWorker };
  } catch (err) {
    console.warn('⚠️ Could not connect to Redis, running embedding jobs in direct mode:', err);
    return { queue: null, worker: null };
  }
}

/**
 * Process single embedding job: generate embedding vector and save to database.
 */
export async function processEmbedJob(data: EmbedJobData): Promise<void> {
  const { observationId, content, orgId } = data;
  const embedding = await generateEmbedding(content);

  const pool = getDbPool();
  if (pool) {
    try {
      await withTenantContext({ orgId }, async (client) => {
        // Format vector for pgvector literal: e.g. '[0.1, 0.2, ...]'
        const vectorLiteral = `[${embedding.join(',')}]`;
        await client.query(
          `UPDATE observations 
           SET embedding = $1::vector, status = 'indexed', updated_at = now() 
           WHERE id = $2 AND org_id = $3`,
          [vectorLiteral, observationId, orgId]
        );
      });
    } catch (err) {
      console.error(`Failed to update observation ${observationId} embedding in DB:`, err);
      throw err;
    }
  }

  if (directUpdateCallback) {
    await directUpdateCallback(observationId, embedding);
  }
}

/**
 * Enqueue an observation for background embedding generation.
 */
export async function enqueueEmbeddingJob(data: EmbedJobData): Promise<void> {
  if (embedQueue) {
    try {
      await embedQueue.add('embed-observation', data, {
        jobId: `embed-${data.observationId}`,
      });
      return;
    } catch (err) {
      console.warn('⚠️ Failed to enqueue to BullMQ, falling back to direct background processing:', err);
    }
  }

  // Fallback: direct processing when BullMQ is not connected
  try {
    await processEmbedJob(data);
  } catch (err) {
    console.error(`Direct embedding processing failed for ${data.observationId}:`, err);
  }
}

/**
 * Clean up queue & worker connections on shutdown
 */
export async function closeQueue(): Promise<void> {
  if (embedWorker) {
    await embedWorker.close();
    embedWorker = null;
  }
  if (embedQueue) {
    await embedQueue.close();
    embedQueue = null;
  }
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
}
