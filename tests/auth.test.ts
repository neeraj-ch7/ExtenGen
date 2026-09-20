import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey, resolveAuthContext } from '../src/services/auth.js';

describe('Auth & Multi-Tenancy Service', () => {
  it('should generate properly formatted API keys with correct prefix and hash', () => {
    const key = generateApiKey('live');

    expect(key.rawKey).toMatch(/^ext_live_[a-f0-9]{48}$/);
    expect(key.keyPrefix).toBe(key.rawKey.slice(0, 12));
    expect(key.keyHash).toHaveLength(64);
    expect(hashApiKey(key.rawKey)).toBe(key.keyHash);
  });

  it('should generate test prefix API keys', () => {
    const key = generateApiKey('test');
    expect(key.rawKey).toMatch(/^ext_test_[a-f0-9]{48}$/);
  });

  it('should resolve direct org:user header into TenantContext', async () => {
    const orgId = '11111111-1111-1111-1111-111111111111';
    const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const authHeader = `Bearer ${orgId}:${userId}`;

    const context = await resolveAuthContext(authHeader);
    expect(context.orgId).toBe(orgId);
    expect(context.userId).toBe(userId);
  });

  it('should fallback to default tenant when no auth header provided', async () => {
    const context = await resolveAuthContext(undefined);
    expect(context.orgId).toBeDefined();
    expect(context.userId).toBeDefined();
  });
});
