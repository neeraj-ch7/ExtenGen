import pg from 'pg';
import pgvector from 'pgvector/pg';
import { env } from '../config/env.js';
import { TenantContext } from './schema.js';

const { Pool } = pg;

// Connection pool for PostgreSQL / Supabase
let pool: pg.Pool | null = null;

export function getDbPool(): pg.Pool | null {
  if (pool) return pool;

  if (env.DATABASE_URL) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: env.DATABASE_URL.includes('supabase') || env.NODE_ENV === 'production' 
        ? { rejectUnauthorized: false } 
        : undefined,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('connect', async (client) => {
      try {
        await pgvector.registerType(client);
      } catch (err) {
        // pgvector might not be registered yet if migrations haven't run
      }
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
    });

    return pool;
  }

  return null;
}

/**
 * Execute a callback within a database client session where PostgreSQL RLS session variables
 * (app.current_org_id, app.current_user_id, app.bypass_rls) are set inside a transaction.
 */
export async function withTenantContext<T>(
  context: TenantContext,
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const currentPool = getDbPool();
  if (!currentPool) {
    throw new Error('Database pool not initialized. Set DATABASE_URL in environment.');
  }

  const client = await currentPool.connect();
  try {
    await client.query('BEGIN');

    if (context.bypassRls) {
      await client.query("SET LOCAL app.bypass_rls = 'true'");
    } else {
      await client.query("SET LOCAL app.bypass_rls = 'false'");
      if (context.orgId) {
        await client.query('SET LOCAL app.current_org_id = $1', [context.orgId]);
      }
      if (context.userId) {
        await client.query('SET LOCAL app.current_user_id = $1', [context.userId]);
      }
    }

    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close database connections
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
