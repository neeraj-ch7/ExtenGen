import { getDbPool, withTenantContext } from '../db/client.js';
import { generateApiKey } from '../services/auth.js';
import { storeObservation } from '../services/observations.js';

export const DUMMY_ORGS = {
  acme: {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Acme Software',
    slug: 'acme',
  },
  stark: {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Stark Industries',
    slug: 'stark',
  },
};

export const DUMMY_USERS = {
  alice: {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    org_id: DUMMY_ORGS.acme.id,
    email: 'alice@acme.corp',
    name: 'Alice Developer',
    role: 'admin' as const,
  },
  bob: {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    org_id: DUMMY_ORGS.stark.id,
    email: 'bob@stark.corp',
    name: 'Bob Engineer',
    role: 'member' as const,
  },
};

export async function runSeed(): Promise<void> {
  console.log('🌱 Seeding database with test organizations, users, and observations...');
  const pool = getDbPool();

  if (pool) {
    // 1. Seed Organizations
    for (const org of Object.values(DUMMY_ORGS)) {
      await pool.query(
        `INSERT INTO organizations (id, name, slug)
         VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name`,
        [org.id, org.name, org.slug]
      );
    }

    // 2. Seed Users
    for (const user of Object.values(DUMMY_USERS)) {
      await pool.query(
        `INSERT INTO users (id, org_id, email, name, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (org_id, email) DO UPDATE SET name = EXCLUDED.name`,
        [user.id, user.org_id, user.email, user.name, user.role]
      );
    }

    // 3. Seed API Keys
    const acmeKey = generateApiKey('live');
    await pool.query(
      `INSERT INTO api_keys (id, key_hash, key_prefix, name, org_id, user_id)
       VALUES (gen_random_uuid(), $1, $2, 'Acme Default Key', $3, $4)
       ON CONFLICT (key_hash) DO NOTHING`,
      [acmeKey.keyHash, acmeKey.keyPrefix, DUMMY_ORGS.acme.id, DUMMY_USERS.alice.id]
    );
  }

  // 4. Seed Acme Observations (Org 1)
  const acmeTenant = { orgId: DUMMY_ORGS.acme.id, userId: DUMMY_USERS.alice.id };
  await storeObservation(acmeTenant, {
    title: 'Database Architecture Decision: PostgreSQL + pgvector',
    content: 'We chose PostgreSQL with pgvector hosted on Supabase for our vector storage because PostgreSQL provides native Row Level Security (RLS) for multi-tenant isolation, eliminating the need for complex external vector DB security silos.',
    source: 'agent_session',
    tags: ['database', 'pgvector', 'architecture', 'supabase'],
    immediateEmbed: true,
  });

  await storeObservation(acmeTenant, {
    title: 'Authentication Standard: JWT & API Keys',
    content: 'All agent requests must include an ExtenGen API key (prefix ext_live_ or ext_test_). The middleware hashes the token using SHA-256 and sets the PostgreSQL session variables app.current_org_id and app.current_user_id before executing any query.',
    source: 'agent_session',
    tags: ['auth', 'security', 'rls'],
    immediateEmbed: true,
  });

  // 5. Seed Stark Observations (Org 2)
  const starkTenant = { orgId: DUMMY_ORGS.stark.id, userId: DUMMY_USERS.bob.id };
  await storeObservation(starkTenant, {
    title: 'Proprietary Arc Reactor Firmware Spec',
    content: 'The Mark 85 Arc Reactor utilizes palladium alloy core with quantum resonance frequency modulated at 4.2 GHz. All power distribution routines must bypass standard circuit breakers.',
    source: 'agent_session',
    tags: ['hardware', 'firmware', 'classified'],
    immediateEmbed: true,
  });

  console.log('✅ Seeding completed.');
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}
