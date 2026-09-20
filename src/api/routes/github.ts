import { FastifyPluginAsync } from 'fastify';
import { resolveAuthContext } from '../../services/auth.js';
import { ingestGitHubRepo, fetchAndIngestFromGitHubAPI } from '../../services/github.js';

export const githubRoutes: FastifyPluginAsync = async (fastify) => {
  // Ingest from API or payload
  fastify.post('/api/v1/ingest/github', async (request, reply) => {
    const authHeader = request.headers.authorization;
    const tenant = await resolveAuthContext(authHeader);
    const body = request.body as any;

    if (!body || !body.repo) {
      return reply.status(400).send({ error: 'Field "repo" is required (e.g. "owner/repo").' });
    }

    // If explicit commits/PRs provided in payload
    if (body.commits || body.pullRequests) {
      const result = await ingestGitHubRepo(tenant, {
        repo: body.repo,
        branch: body.branch,
        commits: body.commits,
        pullRequests: body.pullRequests,
      });

      return reply.status(200).send({
        success: true,
        ...result,
      });
    }

    // Otherwise fetch from GitHub REST API
    const result = await fetchAndIngestFromGitHubAPI(
      tenant,
      body.repo,
      body.token,
      body.limit || 10
    );

    return reply.status(200).send({
      success: true,
      repo: body.repo,
      ...result,
    });
  });

  // GitHub Webhook listener (for automated push / pull_request events)
  fastify.post('/api/v1/webhooks/github', async (request, reply) => {
    const authHeader = request.headers.authorization;
    const tenant = await resolveAuthContext(authHeader);
    const event = request.headers['x-github-event'] as string;
    const payload = request.body as any;

    if (!payload || !payload.repository) {
      return reply.status(400).send({ error: 'Invalid webhook payload.' });
    }

    const repoName = payload.repository.full_name;

    if (event === 'push' && payload.commits && Array.isArray(payload.commits)) {
      const commits = payload.commits.map((c: any) => ({
        hash: c.id,
        message: c.message,
        author: c.author?.name || c.author?.username || 'unknown',
        filesChanged: [...(c.added || []), ...(c.modified || [])],
      }));

      const result = await ingestGitHubRepo(tenant, {
        repo: repoName,
        branch: payload.ref?.replace('refs/heads/', '') || 'main',
        commits,
      });

      return reply.send({ success: true, event: 'push', ...result });
    }

    if (event === 'pull_request' && payload.action === 'closed' && payload.pull_request?.merged) {
      const pr = payload.pull_request;
      const result = await ingestGitHubRepo(tenant, {
        repo: repoName,
        pullRequests: [
          {
            number: pr.number,
            title: pr.title,
            body: pr.body || '',
            author: pr.user?.login || 'unknown',
            mergedAt: pr.merged_at,
            baseBranch: pr.base?.ref,
            headBranch: pr.head?.ref,
          },
        ],
      });

      return reply.send({ success: true, event: 'pull_request_merged', ...result });
    }

    return reply.send({ received: true, ignored: true, event });
  });
};
