import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { TenantContext } from '../db/schema.js';
import {
  handleStoreObservation,
  handleRecallContext,
  handleListObservations,
  handleIngestGitHub,
} from './tools.js';

/**
 * Define tool metadata for MCP discovery
 */
const TOOLS_DEFINITIONS: Tool[] = [
  {
    name: 'store_observation',
    description: 'Capture and persist an architectural decision, code pattern, bug fix, task summary, or institutional knowledge into ExtenGen shared memory. Automatically embedded for semantic retrieval.',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The observation text, architectural decision, code diff, or context to persist.',
        },
        title: {
          type: 'string',
          description: 'Optional short title (e.g. "Auth Token Refresh Strategy").',
        },
        source: {
          type: 'string',
          description: 'Source identifier (e.g. "agent_session", "manual", "documentation"). Default is "agent_session".',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional array of tags for filtering (e.g. ["database", "pgvector"]).',
        },
        metadata: {
          type: 'object',
          description: 'Optional structured metadata (e.g. file paths, commit hash, session id).',
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'recall_context',
    description: 'Retrieve relevant prior architectural decisions, team discussions, past bug fixes, and shared context via semantic vector similarity search. Returns formatted context ready for prompt injection.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The semantic search query, prompt, or question to recall related memories for.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of memories to return (default: 5).',
        },
        similarity_threshold: {
          type: 'number',
          description: 'Minimum cosine similarity threshold between 0.0 and 1.0 (default: 0.50).',
        },
        sources: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of sources to filter by (e.g. ["agent_session", "github_commit"]).',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of tags to filter by.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_observations',
    description: 'List recent observations stored in the shared memory layer for this organization.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of observations to return (default: 10).',
        },
        source: {
          type: 'string',
          description: 'Optional source filter.',
        },
      },
    },
  },
  {
    name: 'ingest_github',
    description: 'Ingest commit history and PR descriptions from a GitHub repository into shared memory.',
    inputSchema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository name in "owner/repo" format.',
        },
        token: {
          type: 'string',
          description: 'Optional GitHub personal access token.',
        },
        limit: {
          type: 'number',
          description: 'Number of recent commits/PRs to fetch (default: 10).',
        },
      },
      required: ['repo'],
    },
  },
];

/**
 * Create a configured MCP Server instance attached to a specific TenantContext
 */
export function createExtenGenMcpServer(tenantContext: TenantContext): Server {
  const server = new Server(
    {
      name: 'extengen-memory-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 1. Tool discovery handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOLS_DEFINITIONS,
    };
  });

  // 2. Tool execution handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'store_observation':
          return await handleStoreObservation(tenantContext, args as any);

        case 'recall_context':
          return await handleRecallContext(tenantContext, args as any);

        case 'list_observations':
          return await handleListObservations(tenantContext, args as any);

        case 'ingest_github':
          return await handleIngestGitHub(tenantContext, args as any);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error executing ${name}: ${error?.message || String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}
