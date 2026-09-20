import { FastifyPluginAsync } from 'fastify';
import { resolveAuthContext } from '../../services/auth.js';
import { recallContext } from '../../services/observations.js';

export const recallRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/v1/context/recall', async (request, reply) => {
    const authHeader = request.headers.authorization;
    const tenant = await resolveAuthContext(authHeader);
    const body = request.body as any;

    if (!body || !body.query) {
      return reply.status(400).send({ error: 'Field "query" is required.' });
    }

    const result = await recallContext(tenant, {
      query: body.query,
      limit: body.limit ? parseInt(body.limit, 10) : 5,
      similarityThreshold: body.similarityThreshold !== undefined ? parseFloat(body.similarityThreshold) : 0.50,
      sources: body.sources,
      tags: body.tags,
    });

    return {
      success: true,
      result,
    };
  });
};
