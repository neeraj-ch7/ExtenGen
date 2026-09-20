import { FastifyPluginAsync } from 'fastify';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createExtenGenMcpServer } from '../mcp/server.js';
import { resolveAuthContext } from '../services/auth.js';

// Map of active SSE transports by sessionId
const activeTransports = new Map<string, SSEServerTransport>();

export const sseRoutes: FastifyPluginAsync = async (fastify) => {
  // SSE Connection endpoint
  fastify.get('/sse', async (request, reply) => {
    const authHeader = request.headers.authorization;
    const tenant = await resolveAuthContext(authHeader);

    // Create MCP Server for this tenant
    const server = createExtenGenMcpServer(tenant);

    // Raw Node.js response for SSE streaming
    const res = reply.raw;
    const transport = new SSEServerTransport('/messages', res);
    const sessionId = transport.sessionId;

    activeTransports.set(sessionId, transport);

    transport.onclose = () => {
      activeTransports.delete(sessionId);
    };

    await server.connect(transport);
  });

  // Client message posting endpoint
  fastify.post('/messages', async (request, reply) => {
    const sessionId = (request.query as any)?.sessionId;

    if (!sessionId) {
      return reply.status(400).send({ error: 'Missing sessionId query parameter.' });
    }

    const transport = activeTransports.get(sessionId);
    if (!transport) {
      return reply.status(404).send({ error: `Session ${sessionId} not found.` });
    }

    await transport.handlePostMessage(request.raw, reply.raw, request.body);
  });
};
