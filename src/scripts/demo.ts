import { storeObservation, recallContext, clearMemoryStore } from '../services/observations.js';
import { runSeed, DUMMY_ORGS, DUMMY_USERS } from './seed.js';

const SLEEP = (ms: number) => new Promise(r => setTimeout(r, ms));

function printBanner(title: string) {
  console.log('\n' + '='.repeat(80));
  console.log(`  ${title}`);
  console.log('='.repeat(80) + '\n');
}

async function runDemo() {
  clearMemoryStore();
  printBanner('🧠 ExtenGen — Shared Persistent Memory Layer for AI Coding Agents Demo');

  console.log('Initializing ExtenGen environment and seeding multi-tenant database...');
  await runSeed();
  await SLEEP(500);

  const orgA = { orgId: DUMMY_ORGS.acme.id, userId: DUMMY_USERS.alice.id };
  const orgB = { orgId: DUMMY_ORGS.stark.id, userId: DUMMY_USERS.bob.id };

  // ---------------------------------------------------------------------------
  // STEP 1: Capture Phase (Session 1)
  // ---------------------------------------------------------------------------
  printBanner('STEP 1: Capture Phase (Session 1 with Agent Alice)');
  console.log('📝 Scenario: Alice finishes building the billing service and records an architectural decision.\n');

  console.log('🤖 Agent Tool Call -> store_observation(');
  console.log('   title: "Stripe Webhook Idempotency Pattern",');
  console.log('   source: "agent_session",');
  console.log('   content: "All Stripe webhook events are processed using a Redis-backed idempotency key formatted as `stripe:evt:${event.id}` with a 24-hour TTL. Duplicate deliveries are acknowledged with 200 OK immediately without re-processing."');
  console.log(')\n');

  const obs = await storeObservation(orgA, {
    title: 'Stripe Webhook Idempotency Pattern',
    source: 'agent_session',
    content: 'All Stripe webhook events are processed using a Redis-backed idempotency key formatted as `stripe:evt:${event.id}` with a 24-hour TTL. Duplicate deliveries are acknowledged with 200 OK immediately without re-processing.',
    tags: ['stripe', 'webhooks', 'idempotency', 'redis'],
    immediateEmbed: true,
  });

  console.log(`✅ [ExtenGen] Stored Observation ID: ${obs.id}`);
  console.log(`⚡ [ExtenGen] Background Worker generated 1536-dim vector embedding & indexed in pgvector.\n`);
  await SLEEP(1000);

  // ---------------------------------------------------------------------------
  // STEP 2: The Problem (Session 2 Without ExtenGen)
  // ---------------------------------------------------------------------------
  printBanner('STEP 2: The Problem — Session 2 WITHOUT ExtenGen Memory');
  console.log('Scenario: Next week, Bob starts a new Claude Code session to handle refund webhooks.\n');
  console.log('👤 Developer: "How should I handle idempotency for our new refund webhook listener?"');
  console.log('❌ Agent (Without Memory):');
  console.log('   "I don\'t have access to your prior codebase decisions. You could use an in-memory Map, or maybe create a new SQL table called `processed_events`? How would you like me to implement it?"');
  console.log('   👉 Result: Wasted tokens, inconsistent architecture, developer has to re-explain everything.\n');
  await SLEEP(1200);

  // ---------------------------------------------------------------------------
  // STEP 3: The Solution (Session 2 WITH ExtenGen recall_context)
  // ---------------------------------------------------------------------------
  printBanner('STEP 3: The Solution — Session 2 WITH ExtenGen recall_context');
  console.log('Scenario: Bob starts a new session with ExtenGen MCP enabled.\n');
  console.log('👤 Developer: "How should I handle idempotency for our new refund webhook listener?"');
  console.log('🤖 Agent executes MCP Tool: recall_context(query: "webhook idempotency handling")\n');

  const recallResult = await recallContext(orgA, {
    query: 'webhook idempotency handling Redis pattern',
    limit: 3,
    similarityThreshold: 0.40,
  });

  console.log('📥 [ExtenGen Server Response]');
  console.log(recallResult.formattedContext);
  console.log('\n✅ Agent (With Recalled Context):');
  console.log('   "Based on our team\'s architectural standard recorded in session 1, we handle webhook idempotency using Redis keys formatted as `stripe:evt:${event.id}` with a 24-hour TTL. I will implement the refund webhook listener following this exact pattern to ensure consistency."\n');
  await SLEEP(1200);

  // ---------------------------------------------------------------------------
  // STEP 4: Multi-Tenant Row Level Security (RLS) Isolation
  // ---------------------------------------------------------------------------
  printBanner('STEP 4: Strict Multi-Tenant Isolation (RLS Verification)');
  console.log('Scenario: A competitor/separate organization (Org B: Stark Industries) runs the exact same query.\n');

  console.log('🔒 Org B (Stark Industries) executes: recall_context(query: "webhook idempotency handling")');
  const orgBRecall = await recallContext(orgB, {
    query: 'webhook idempotency handling Redis pattern',
    limit: 3,
    similarityThreshold: 0.40,
  });

  console.log(`📊 Org B Matches Found: ${orgBRecall.matchesCount}`);
  if (orgBRecall.matchesCount === 0) {
    console.log('🛡️ [RLS Verification Passed] Org B receives 0 results! Org A\'s memories are 100% isolated.\n');
  } else {
    console.error('❌ SECURITY BREACH: Cross-tenant leakage detected!');
  }

  // Check Org B's own memory recall
  console.log('🔒 Org B queries for its own memory: recall_context(query: "arc reactor firmware frequency")');
  const orgBOwnRecall = await recallContext(orgB, {
    query: 'arc reactor firmware frequency specs',
    limit: 2,
    similarityThreshold: 0.40,
  });
  console.log(`📊 Org B Matches Found for own memory: ${orgBOwnRecall.matchesCount}`);
  console.log(orgBOwnRecall.formattedContext);

  printBanner('🎉 End-to-End Pipeline Demonstration Complete!');
  console.log('✅ Capture  -> store_observation');
  console.log('✅ Embed    -> text-embedding-3-small (1536 dims)');
  console.log('✅ Store    -> PostgreSQL + pgvector + RLS');
  console.log('✅ Retrieve -> recall_context (cosine similarity search)');
  console.log('✅ Inject   -> Markdown prompt block for LLM prompt context\n');
}

runDemo().catch((err) => {
  console.error('Demo error:', err);
  process.exit(1);
});
