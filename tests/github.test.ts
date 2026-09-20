import { describe, it, expect, beforeEach } from 'vitest';
import { clearMemoryStore, recallContext } from '../src/services/observations.js';
import { ingestGitHubRepo } from '../src/services/github.js';

describe('GitHub Ingestion Pipeline', () => {
  const tenant = {
    orgId: '11111111-1111-1111-1111-111111111111',
    userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  };

  beforeEach(() => {
    clearMemoryStore();
  });

  it('should ingest commits and PRs into shared memory and make them recallable', async () => {
    const ingestResult = await ingestGitHubRepo(tenant, {
      repo: 'extengen/core-engine',
      branch: 'main',
      commits: [
        {
          hash: 'a1b2c3d4e5f6',
          author: 'dev-alice',
          message: 'refactor(auth): migrate token hashing from md5 to sha256 with salt',
          filesChanged: ['src/auth.ts', 'src/crypto.ts'],
        },
      ],
      pullRequests: [
        {
          number: 42,
          title: 'Add support for HNSW pgvector indexing',
          author: 'dev-bob',
          body: 'This PR upgrades vector indexes to use HNSW with m=16 and ef_construction=64 for sub-millisecond retrieval.',
          baseBranch: 'main',
          headBranch: 'feature/hnsw-index',
        },
      ],
    });

    expect(ingestResult.ingestedCommits).toBe(1);
    expect(ingestResult.ingestedPRs).toBe(1);
    expect(ingestResult.observationIds).toHaveLength(2);

    // Now test recalling the GitHub PR decision via semantic query
    const recallPR = await recallContext(tenant, {
      query: 'What parameters do we use for HNSW vector indexing in pgvector?',
      limit: 3,
      similarityThreshold: 0.35,
    });

    expect(recallPR.matchesCount).toBeGreaterThanOrEqual(1);
    expect(recallPR.formattedContext).toContain('HNSW');
    expect(recallPR.formattedContext).toContain('m=16');
    expect(recallPR.formattedContext).toContain('github_pr');

    // Test recalling commit
    const recallCommit = await recallContext(tenant, {
      query: 'token hashing algorithm sha256 auth migration',
      limit: 3,
      similarityThreshold: 0.20,
    });

    expect(recallCommit.matchesCount).toBeGreaterThanOrEqual(1);
    expect(recallCommit.formattedContext).toContain('sha256');
    expect(recallCommit.formattedContext).toContain('github_commit');
  });
});
