import { describe, it, expect, beforeEach } from 'vitest';
import { clearMemoryStore } from '../src/services/observations.js';
import {
  handleStoreObservation,
  handleRecallContext,
  handleListObservations,
} from '../src/mcp/tools.js';

describe('MCP Tools Handlers', () => {
  const tenant = {
    orgId: '11111111-1111-1111-1111-111111111111',
    userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  };

  beforeEach(() => {
    clearMemoryStore();
  });

  it('handleStoreObservation should capture text and return confirmation', async () => {
    const res = await handleStoreObservation(tenant, {
      title: 'Database Schema Rule',
      content: 'All database tables must have id, created_at, and updated_at columns.',
      source: 'agent_session',
      tags: ['database', 'standards'],
    });

    expect(res.content).toHaveLength(1);
    expect(res.content[0].type).toBe('text');

    const parsed = JSON.parse(res.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.observation.title).toBe('Database Schema Rule');
    expect(parsed.observation.org_id).toBe(tenant.orgId);
  });

  it('handleRecallContext should retrieve formatted memory block for prompt injection', async () => {
    // Store an initial decision
    await handleStoreObservation(tenant, {
      title: 'Caching Strategy',
      content: 'We use Redis caching with a 5-minute TTL for all public product catalog endpoints.',
      source: 'agent_session',
      tags: ['caching', 'redis', 'performance'],
    });

    // Run recall tool
    const res = await handleRecallContext(tenant, {
      query: 'What is our caching strategy for product catalog?',
      limit: 3,
      similarity_threshold: 0.35,
    });

    expect(res.content).toHaveLength(1);
    expect(res.content[0].text).toContain('ExtenGen Shared Memory');
    expect(res.content[0].text).toContain('Caching Strategy');
    expect(res.content[0].text).toContain('Redis caching with a 5-minute TTL');
    expect(res._meta.matchesCount).toBeGreaterThanOrEqual(1);
  });

  it('handleListObservations should return list of stored observations', async () => {
    await handleStoreObservation(tenant, {
      title: 'Memory 1',
      content: 'Observation content number one.',
    });
    await handleStoreObservation(tenant, {
      title: 'Memory 2',
      content: 'Observation content number two.',
    });

    const res = await handleListObservations(tenant, { limit: 10 });
    const parsed = JSON.parse(res.content[0].text);

    expect(parsed.count).toBe(2);
    expect(parsed.observations).toHaveLength(2);
  });
});
