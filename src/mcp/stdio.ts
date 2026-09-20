import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createExtenGenMcpServer } from './server.js';
import { resolveAuthContext } from '../services/auth.js';
import { initQueue } from '../services/queue.js';
import { env } from '../config/env.js';

async function main() {
  // Initialize background queue if Redis is configured
  initQueue();

  // Resolve tenant context from environment variables
  const authHeader = process.env.EXTENGEN_API_KEY 
    ? `Bearer ${process.env.EXTENGEN_API_KEY}` 
    : (process.env.EXTENGEN_AUTH_HEADER || undefined);

  const tenantContext = await resolveAuthContext(authHeader);

  // If explicit org/user env vars are set, override
  if (process.env.EXTENGEN_ORG_ID) {
    tenantContext.orgId = process.env.EXTENGEN_ORG_ID;
  }
  if (process.env.EXTENGEN_USER_ID) {
    tenantContext.userId = process.env.EXTENGEN_USER_ID;
  }

  // Create MCP Server for this tenant
  const server = createExtenGenMcpServer(tenantContext);
  const transport = new StdioServerTransport();

  // Connect server to stdio transport
  await server.connect(transport);
  
  // Log to stderr so stdout is strictly preserved for MCP JSON-RPC messages
  console.error(`🧠 ExtenGen MCP Server running on stdio (Org: ${tenantContext.orgId})`);
}

main().catch((error) => {
  console.error('Fatal error in MCP Stdio server:', error);
  process.exit(1);
});
