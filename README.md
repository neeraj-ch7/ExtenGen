# 🧠 ExtenGen

> **A High-Performance, Multi-Tenant Shared Memory Layer for AI Coding Agents**  
> *Connecting ephemeral LLM coding sessions into continuous, persistent institutional intelligence via the Model Context Protocol (MCP) and pgvector.*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Standard%20v1.6-purple.svg)](https://modelcontextprotocol.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2B%20%7C%20pgvector-336791.svg?logo=postgresql)](https://github.com/pgvector/pgvector)
[![Fastify](https://img.shields.io/badge/Fastify-5.2-black.svg?logo=fastify)](https://www.fastify.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-Redis%20Queue-red.svg)](https://bullmq.io/)
[![Tests](https://img.shields.io/badge/Tests-14%20Passing-brightgreen.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📑 Table of Contents

1. [Executive Summary & Core Idea](#-the-idea)
2. [The Problem & Industry Gap](#-the-problem--industry-gap)
3. [The ExtenGen Solution](#-the-extengen-solution)
4. [System Architecture & Workflow](#-system-architecture--workflow)
   - [High-Level Architecture](#high-level-architecture)
   - [Memory Lifecycle Flow](#memory-lifecycle-dataflow)
   - [Multi-Tenant Row-Level Security (RLS)](#multi-tenant-isolation--security)
5. [Tech Stack & Technology Decisions](#-tech-stack)
6. [Repository Structure](#-repository-structure)
7. [⚡ Complete Commands Reference & Getting Started](#-complete-commands-reference--getting-started)
   - [📋 One-Liner Quickstart](#-one-liner-quickstart)
   - [📑 NPM Scripts Cheatsheet](#-npm-scripts-cheatsheet)
   - [🐳 Optional Docker Infrastructure Setup (PostgreSQL + Redis)](#-optional-docker-infrastructure-setup)
   - [📦 Step-by-Step Command Lifecycle](#-step-by-step-command-lifecycle)
   - [🔌 Connecting Claude Code, Claude Desktop, Cursor & Windsurf](#-connecting-to-agents-and-ides)
   - [📡 Quick cURL & REST API Verification Commands](#-quick-curl--rest-api-verification-commands)
8. [MCP Tools & REST API Reference](#-mcp-tools--api-reference)
9. [Areas of Research & Theoretical Foundations](#-areas-of-research)
10. [Future Scope & Roadmap](#-future-scope--roadmap)
11. [Academic References & Prior Art](#-references--academic-citations)
12. [Conclusion & Contributing](#-conclusion--contributing)

---

## 💡 The Idea

Modern AI coding agents (such as **Claude Code**, **Cursor**, **Windsurf**, **Aider**, and **GitHub Copilot**) are revolutionizing software development. However, they suffer from **session-level amnesia**: every new terminal process, prompt session, or PR review starts with zero knowledge of prior architectural decisions, debugging breakthroughs, schema conventions, or past team discussions.

**ExtenGen** (*Extended Generation Memory*) is a lightweight, cloud-native **shared persistent memory layer** designed specifically for AI coding agents. It implements Anthropic's **Model Context Protocol (MCP)** to provide agents with a standardized, two-way cognitive memory bus:
- **Write-Back (Capture Phase):** Agents capture and store crucial architectural decisions, bug diagnoses, coding standards, and PR context as structured *observations*.
- **Semantic Read (Recall Phase):** Subsequent agents running in any terminal, machine, or CI environment query this memory layer using dense vector similarity search (`pgvector` with HNSW cosine distance), retrieving exact historical rationale and guidelines before generating code.

```
       Ephemeral Agent Session (Alice)                  Ephemeral Agent Session (Bob)
   +-------------------------------------+          +-------------------------------------+
   | "Decided on Redis idempotency keys  |          | "How should I handle webhook        |
   |  for Stripe webhooks with 24h TTL"  |          |  idempotency on this refund route?" |
   +-------------------------------------+          +-------------------------------------+
                      |                                                ^
                      |  store_observation                             |  recall_context
                      v                                                |
          +----------------------------------------------------------------+
          |               🧠  ExtenGen Shared Memory Layer                |
          |       (PostgreSQL 16 + pgvector + BullMQ + MCP Server)         |
          +----------------------------------------------------------------+
```

---

## ⚠️ The Problem & Industry Gap

### 1. The Amnesia Problem in Autonomous Coding Agents
When an engineer solves an elusive bug (e.g., configuring database connection pool pooling for serverless cold starts), that insight lives solely inside the ephemeral LLM context window. Once the session terminates, that context is permanently lost. The next agent prompt by another team member—or even the same developer the next day—will likely reintroduce the exact same bug or propose conflicting patterns.

### 2. Context Window Exhaustion & Token Inefficiency
Naive attempts to fix agent amnesia involve dumping massive `AGENTS.md`, `README.md`, or architecture documents directly into system prompts. This strategy suffers from:
- **Token Inflation:** High costs and increased latency per API call.
- **Attention Degradation (Lost in the Middle):** LLMs struggle to attend to specific instructions when buried inside 50KB+ prompt dumps.
- **Stale Documentation:** Static markdown files fail to capture continuous, micro-level decisions made during active development.

### 3. Cross-Developer & Cross-Agent Fragmentation
In multi-developer teams, multiple AI agents run simultaneously across different branches. Without a shared memory layer, agent actions drift apart, creating architectural inconsistency (e.g., one agent implements JWT bearer auth while another introduces API key sessions).

### 4. The Industry Gap
Existing Retrieval-Augmented Generation (RAG) tools are built for **static document search** (searching codebases or PDF manuals). They lack:
- **Dynamic Write-Back Interfaces:** No standardized tooling for agents to persist structured learnings during code generation.
- **Multi-Tenant Row-Level Security (RLS):** Inability to isolate institutional memory across organizations and teams within a shared infrastructure.
- **MCP Native Dual-Transport Support:** Seamless interoperability with local CLI agents (Stdio) and remote agent orchestration platforms (SSE).
- **Asynchronous Embeddings Pipeline:** Non-blocking ingestion that does not freeze agent tool execution while waiting on external embedding API calls.

---

## 🚀 The ExtenGen Solution

ExtenGen resolves these limitations through a purpose-built, agent-first memory engine:

| Challenge | ExtenGen Solution |
| :--- | :--- |
| **Agent Amnesia** | Persistent vector storage in PostgreSQL with `pgvector` preserving institutional knowledge across infinite sessions. |
| **Token Bloat** | Semantic top-$k$ recall (`recall_context`) injects only the most relevant 3–5 observations directly into the LLM context. |
| **Slow Embedding Latency** | Non-blocking BullMQ task queue on Redis processes 1536-dimensional embeddings asynchronously in the background. |
| **Multi-Tenancy & Data Leakage** | Hardened PostgreSQL Row-Level Security (RLS) with session variable tenant isolation (`org_id` / `user_id`). |
| **Protocol Compatibility** | Full Model Context Protocol (MCP) compliance supporting both local `stdio` (Claude Code) and `SSE` (remote agents). |
| **Git Ingestion** | Native GitHub commit & PR ingestion pipelines (`ingest_github`) syncing repository history directly into memory. |
| **Offline/Zero-Cost Dev** | Built-in deterministic pseudo-semantic feature hashing engine for testing without external OpenAI API keys. |

---

## 🏛️ System Architecture & Workflow

### High-Level Architecture

```mermaid
flowchart TB
    subgraph Clients["AI Agent Environments"]
        C1["Claude Code CLI\n(Stdio Transport)"]
        C2["Claude Desktop / Cursor\n(Stdio Transport)"]
        C3["Cloud Agent Orchestrators\n(HTTP / SSE Transport)"]
    end

    subgraph ExtenGen["ExtenGen Memory Layer"]
        subgraph Transports["Transport & Routing Layer"]
            STDIO["MCP Stdio Server\n(src/mcp/stdio.ts)"]
            FASTIFY["Fastify 5 REST & SSE Server\n(src/api/server.ts)"]
        end

        subgraph MCPCore["MCP Core & Tool Handlers"]
            ROUTER["Tool Dispatcher\n(src/mcp/server.ts)"]
            T1["store_observation"]
            T2["recall_context"]
            T3["list_observations"]
            T4["ingest_github"]
        end

        subgraph Services["Domain Services"]
            OBS_SVC["Observation Service\n(src/services/observations.ts)"]
            EMB_SVC["Embedding Service\n(src/services/embeddings.ts)"]
            AUTH_SVC["Auth & Tenant Context\n(src/services/auth.ts)"]
            GIT_SVC["GitHub Sync Service\n(src/services/github.ts)"]
            QUEUE_SVC["BullMQ Queue & Worker\n(src/services/queue.ts)"]
        end
    end

    subgraph ExternalServices["External Infrastructure"]
        OAI["OpenAI API\n(text-embedding-3-small)"]
        REDIS[("Redis 7+\n(Embedding Task Queue)")]
        PG[("PostgreSQL 16 + pgvector\n(HNSW Cosine Distance + RLS)")]
        GH["GitHub REST API\n(Commits & Pull Requests)"]
    end

    C1 -->|JSON-RPC via Stdio| STDIO
    C2 -->|JSON-RPC via Stdio| STDIO
    C3 -->|Server-Sent Events / POST| FASTIFY

    STDIO --> ROUTER
    FASTIFY --> ROUTER

    ROUTER --> T1 & T2 & T3 & T4
    T1 & T2 & T3 --> OBS_SVC
    T4 --> GIT_SVC

    OBS_SVC --> AUTH_SVC
    OBS_SVC --> QUEUE_SVC
    GIT_SVC --> OBS_SVC
    GIT_SVC --> GH

    QUEUE_SVC --> REDIS
    QUEUE_SVC --> EMB_SVC
    EMB_SVC --> OAI

    OBS_SVC -->|Execute SQL & Vector Search| PG
    EMB_SVC -->|Save Vector Index| PG
```

---

### Memory Lifecycle Dataflow

```mermaid
sequenceDiagram
    autonumber
    actor Developer
    participant Agent as AI Coding Agent (Claude Code)
    participant MCP as ExtenGen MCP Server
    participant Queue as Redis / BullMQ Queue
    participant Embed as OpenAI Embeddings (1536-d)
    participant DB as PostgreSQL (pgvector + RLS)

    Note over Developer, DB: 1. CAPTURE PHASE (Session 1)
    Developer->>Agent: "Implement Stripe Webhook handler"
    Agent->>Agent: Completes feature & deduces Redis idempotency pattern
    Agent->>MCP: Call tool: store_observation(title, content, tags)
    MCP->>DB: INSERT INTO observations (status: 'pending_embedding')
    MCP->>Queue: Enqueue embedding job (jobId: embed-uuid)
    MCP-->>Agent: { success: true, id: "obs-123" }
    Agent-->>Developer: "Feature done & decision saved to ExtenGen memory."

    Note over Queue, DB: Asynchronous Background Processing
    Queue->>Embed: Generate vector for content
    Embed-->>Queue: Vector Float32Array[1536]
    Queue->>DB: UPDATE observations SET embedding = vector, status = 'indexed'

    Note over Developer, DB: 2. RECALL PHASE (Session 2 - Days Later / New Agent)
    Developer->>Agent: "Build refund webhook handler"
    Agent->>MCP: Call tool: recall_context(query: "webhook idempotency")
    MCP->>Embed: Embed query string
    Embed-->>MCP: Query Vector[1536]
    MCP->>DB: match_observations(query_vector, threshold: 0.5, org_id: session_org)
    DB-->>MCP: Top-k matching observations (similarity: 0.91)
    MCP-->>Agent: Formatted Markdown Shared Memory Block
    Agent->>Agent: Integrates Redis idempotency pattern from memory
    Agent-->>Developer: "Implemented refund handler following our established Redis idempotency pattern."
```

---

### Multi-Tenant Isolation & Security

ExtenGen is engineered from the ground up for strict multi-tenancy. Every memory item is bound to an `org_id` and optionally a `user_id`. Tenant boundaries are enforced natively at the database level using **PostgreSQL Row-Level Security (RLS)**:

```sql
-- PostgreSQL RLS Tenant Isolation Policy
CREATE POLICY observations_tenant_isolation ON observations
    FOR ALL
    USING (
        org_id = get_current_org_id()
        OR current_setting('app.bypass_rls', true) = 'true'
    )
    WITH CHECK (
        org_id = get_current_org_id()
        OR current_setting('app.bypass_rls', true) = 'true'
    );
```

When an agent authenticates with an ExtenGen API Key (`ext_live_...`) or session header, ExtenGen executes `SET LOCAL app.current_org_id = '<tenant_id>'` inside a transaction block (`withTenantContext`), ensuring that zero queries can cross organizational boundaries.

---

## 🛠️ Tech Stack

ExtenGen uses modern, high-throughput technologies optimized for low latency and type safety:

| Layer | Technology | Rationale & Role |
| :--- | :--- | :--- |
| **Language & Runtime** | Node.js (v20+) / TypeScript 5.8 (ESM) | Type-safe enterprise architecture, modern ECMAScript modules. |
| **Agent Protocol** | `@modelcontextprotocol/sdk` (1.6.1) | Standardized tool schema discovery and execution for Claude & IDEs. |
| **Web & API Framework** | Fastify 5.2 | Ultra-low overhead HTTP & Server-Sent Events (SSE) server. |
| **Database & Vector Search** | PostgreSQL 16+ with `pgvector` (0.2.0) | Multi-tenant relational storage with HNSW cosine similarity index. |
| **Embedding Model** | OpenAI `text-embedding-3-small` (1536-d) | State-of-the-art semantic representation with low cost and high accuracy. |
| **Task Queue & Cache** | Redis 7+ with BullMQ (5.41) | Asynchronous job execution with exponential backoff and retry policies. |
| **Schema Validation** | Zod (3.24) | Runtime input validation for MCP tool parameters and API requests. |
| **Testing Framework** | Vitest (3.0) | High-speed unit and integration testing suite with ESM support. |

---

## 📁 Repository Structure

```
ExtenGen/
├── migrations/
│   └── 001_initial_schema.sql       # PostgreSQL schema: tables, pgvector HNSW index, RLS policies & RPC functions
├── src/
│   ├── index.ts                     # Main entrypoint: starts Fastify server and BullMQ workers
│   ├── api/
│   │   ├── server.ts                # Fastify application builder, CORS, and plugin registration
│   │   ├── sse.ts                   # MCP Server-Sent Events (SSE) streaming transport endpoints
│   │   └── routes/
│   │       ├── health.ts            # GET /health health-check endpoint
│   │       ├── observations.ts      # REST API: store & list observations
│   │       ├── recall.ts            # REST API: semantic context recall
│   │       └── github.ts            # REST API: GitHub ingestion triggers
│   ├── config/
│   │   └── env.ts                   # Type-safe environment variable parsing & defaults
│   ├── db/
│   │   ├── client.ts                # PostgreSQL pg.Pool client and tenant-scoped connection helper
│   │   ├── migrate.ts               # Database migration executor script
│   │   └── schema.ts                # TypeScript data interfaces and database models
│   ├── mcp/
│   │   ├── server.ts                # MCP Server instance factory and tool router
│   │   ├── stdio.ts                 # MCP Stdio transport entrypoint (for Claude Code CLI)
│   │   └── tools.ts                 # MCP tool schemas (Zod) and execution handlers
│   ├── services/
│   │   ├── auth.ts                  # API key generation (SHA-256) & tenant context resolution
│   │   ├── embeddings.ts            # OpenAI embedding client + deterministic mock feature-hasher
│   │   ├── github.ts                # GitHub REST API client for commit & PR memory ingestion
│   │   ├── observations.ts          # Core observation CRUD, vector query execution, & Markdown formatting
│   │   └── queue.ts                 # BullMQ queue & worker for asynchronous vector embedding
│   └── scripts/
│       ├── demo.ts                  # Interactive end-to-end multi-tenant memory demo
│       └── seed.ts                  # Multi-tenant dummy organizations and users seed script
├── tests/
│   ├── auth.test.ts                 # API key and auth resolution unit tests
│   ├── embeddings.test.ts           # Cosine similarity and mock embedding verification
│   ├── github.test.ts               # GitHub commit and PR ingestion unit tests
│   ├── mcp_tools.test.ts            # MCP tool handlers unit tests
│   └── rls_isolation.test.ts        # Multi-tenant isolation verification tests
├── .env.example                     # Environment template configuration
├── package.json                     # NPM project manifest & scripts
├── tsconfig.json                    # TypeScript compiler configuration
└── vitest.config.ts                 # Vitest test runner configuration
```

---

## ⚡ Complete Commands Reference & Getting Started

### 📋 One-Liner Quickstart

To install dependencies, configure environment, and run the end-to-end simulation in 10 seconds:

```bash
git clone https://github.com/neeraj-ch7/ExtenGen.git && cd ExtenGen && npm install && cp .env.example .env && npm run demo
```

---

### 📑 NPM Scripts Cheatsheet

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `tsx watch src/index.ts` | Starts the Fastify REST & MCP SSE server in watch mode with hot reload. |
| `npm run mcp:stdio` | `tsx src/mcp/stdio.ts` | Runs the local MCP Stdio server for direct connection to Claude Code / IDEs. |
| `npm run demo` | `tsx src/scripts/demo.ts` | Runs the end-to-end 4-step memory capture, amnesia comparison, and RLS demo. |
| `npm test` | `vitest run` | Runs the entire test suite (14 unit & integration tests). |
| `npm run test:watch` | `vitest` | Runs Vitest in interactive watch mode for active TDD development. |
| `npm run migrate` | `tsx src/db/migrate.ts` | Executes SQL migrations on PostgreSQL (`001_initial_schema.sql`). |
| `npm run seed` | `tsx src/scripts/seed.ts` | Seeds dummy organizations (Acme Corp & Stark Industries) and test API keys. |
| `npm run build` | `tsc` | Compiles TypeScript into production JavaScript in `./dist`. |
| `npm start` | `node dist/index.js` | Runs the production-built Fastify & BullMQ background worker server. |

---

### 🐳 Optional Docker Infrastructure Setup

If you wish to run a full local PostgreSQL with `pgvector` and a Redis instance via Docker:

```bash
# 1. Start PostgreSQL 16 with pgvector extension
docker run -d \
  --name extengen-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=extengen \
  -p 5432:5432 \
  pgvector/pgvector:pg16

# 2. Start Redis 7 for BullMQ background queue
docker run -d \
  --name extengen-redis \
  -p 6379:6379 \
  redis:7-alpine
```

*(Note: ExtenGen includes a resilient in-memory fallback, so you can run tests and demos even without Docker or Redis!)*

---

### 📦 Step-by-Step Command Lifecycle

#### 1. Clone and Install
```bash
git clone https://github.com/neeraj-ch7/ExtenGen.git
cd ExtenGen
npm install
```

#### 2. Configure Environment
```bash
# Copy example environment configuration
cp .env.example .env
```

Your `.env` will look like:
```env
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# Database connection string (Postgres + pgvector or Supabase)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/extengen

# OpenAI API Key (Leave as 'mock' for local offline testing)
OPENAI_API_KEY=mock
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536

# Redis URL for async job processing
REDIS_URL=redis://localhost:6379

# Single-tenant default IDs for local Stdio agent mode
DEFAULT_ORG_ID=00000000-0000-0000-0000-000000000001
DEFAULT_USER_ID=00000000-0000-0000-0000-000000000002
```

#### 3. Run Database Migrations & Seed
```bash
# Run schema migration (creates vector extension, tables, HNSW index & RLS policies)
npm run migrate

# (Optional) Seed dummy multi-tenant data
npm run seed
```

#### 4. Start the Application

**Option A — Fastify HTTP & MCP SSE Server (for web / remote agent integration):**
```bash
npm run dev
```

**Option B — Direct MCP Stdio Server (for terminal / CLI pipes):**
```bash
npm run mcp:stdio
```

**Option C — Run Interactive Verification Demo:**
```bash
npm run demo
```

**Option D — Run Automated Test Suite:**
```bash
npm test
```

---

### 🔌 Connecting to Agents and IDEs

#### 1. Claude Code CLI Integration
To attach ExtenGen directly to your Claude Code terminal sessions:

```bash
# Using tsx in development
claude mcp add extengen npx -y tsx /absolute/path/to/ExtenGen/src/mcp/stdio.ts

# Or using compiled production build
claude mcp add extengen node /absolute/path/to/ExtenGen/dist/mcp/stdio.js
```

#### 2. Claude Desktop Integration
Add the following to your `claude_desktop_config.json`:
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "extengen": {
      "command": "npx",
      "args": ["-y", "tsx", "C:/Users/ASUS/Desktop/github-local-repo/ExtenGen/src/mcp/stdio.ts"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/extengen",
        "OPENAI_API_KEY": "sk-your-openai-api-key",
        "DEFAULT_ORG_ID": "00000000-0000-0000-0000-000000000001"
      }
    }
  }
}
```

#### 3. Cursor & Windsurf IDE Integration
In Cursor or Windsurf settings $\to$ **Features** $\to$ **MCP Servers** $\to$ **Add New MCP Server**:
- **Name:** `extengen`
- **Type:** `command`
- **Command:** `npx tsx /absolute/path/to/ExtenGen/src/mcp/stdio.ts`

---

### 📡 Quick cURL & REST API Verification Commands

While the server is running (`npm run dev`), test the endpoints directly:

#### 1. Health Check
```bash
curl http://localhost:3000/health
```

#### 2. Store an Observation
```bash
curl -X POST http://localhost:3000/api/v1/observations \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Auth Token Strategy",
    "content": "Access tokens have a 15-minute expiration. Refresh tokens are rotated with sliding 7-day TTL.",
    "tags": ["auth", "jwt", "tokens"],
    "source": "manual"
  }'
```

#### 3. Semantic Context Recall
```bash
curl -X POST http://localhost:3000/api/v1/recall \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the token expiration window?",
    "limit": 3,
    "similarityThreshold": 0.4
  }'
```

#### 4. List Observations
```bash
curl http://localhost:3000/api/v1/observations?limit=5
```

#### 5. Trigger GitHub Repository History Sync
```bash
curl -X POST http://localhost:3000/api/v1/github/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "neeraj-ch7/ExtenGen",
    "limit": 10
  }'
```

---

## 🔧 MCP Tools & API Reference

### MCP Tools Specification

#### 1. `store_observation`
Captures and persists an architectural decision, code pattern, bug fix, or institutional context.

```json
{
  "name": "store_observation",
  "arguments": {
    "content": "All Stripe webhook events must be validated using the Stripe signature header and stored in Redis with key format `stripe:evt:${id}` with a 24-hour TTL for idempotency.",
    "title": "Stripe Webhook Idempotency Standard",
    "source": "agent_session",
    "tags": ["stripe", "webhooks", "redis", "idempotency"],
    "metadata": {
      "author": "Alice",
      "related_file": "src/services/billing.ts"
    }
  }
}
```

#### 2. `recall_context`
Performs cosine similarity vector search over the organization's indexed memory, returning a prompt-injectable markdown block.

```json
{
  "name": "recall_context",
  "arguments": {
    "query": "How are we handling Stripe webhook idempotency?",
    "limit": 3,
    "similarity_threshold": 0.50,
    "tags": ["webhooks"]
  }
}
```

**Sample Formatted Response:**
```markdown
### 🧠 ExtenGen Shared Memory (1 relevant observation retrieved):

#### Observation 1 — Stripe Webhook Idempotency Standard
[Source: agent_session [Tags: stripe, webhooks, redis, idempotency] | Relevance: 94% | Date: 2026-09-20]
```text
All Stripe webhook events must be validated using the Stripe signature header and stored in Redis with key format `stripe:evt:${id}` with a 24-hour TTL for idempotency.
```

*Use the above context to inform your architectural decisions and code changes consistently with past team work.*
```

#### 3. `list_observations`
Returns a chronological list of recent observations recorded for the current tenant.

```json
{
  "name": "list_observations",
  "arguments": {
    "limit": 10,
    "source": "agent_session"
  }
}
```

#### 4. `ingest_github`
Fetches recent commits and pull requests from a GitHub repository, parsing them into structured memory observations.

```json
{
  "name": "ingest_github",
  "arguments": {
    "repo": "neeraj-ch7/ExtenGen",
    "limit": 15
  }
}
```

---

### REST API Endpoints

| Method | Route | Description | Headers / Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Server health check and timestamp. | None |
| `POST` | `/api/v1/observations` | Store an observation via HTTP REST. | `Authorization: Bearer <key>` |
| `GET` | `/api/v1/observations` | List recent observations. | `Authorization: Bearer <key>` |
| `POST` | `/api/v1/recall` | Retrieve top-$k$ semantic observations. | `Authorization: Bearer <key>` |
| `POST` | `/api/v1/github/ingest` | Trigger repository commit/PR ingestion. | `Authorization: Bearer <key>` |
| `GET` | `/sse` | MCP Server-Sent Events stream initialization. | `Authorization: Bearer <key>` |
| `POST` | `/messages?sessionId=...` | MCP JSON-RPC message delivery endpoint. | None |

---

## 🔬 Areas of Research

ExtenGen operates at the intersection of several cutting-edge AI and systems research domains:

### 1. Episodic & Semantic Cognitive Architectures for LLM Agents
Traditional software agents lack cognitive reflection loops. ExtenGen builds upon principles established in cognitive science and human memory models:
- **Episodic Memory:** Capturing discrete temporal events (such as a specific commit, a test failure, or a debugging session).
- **Semantic Memory:** Distilling universal architectural invariants, coding rules, and conventions across episodes.

### 2. Context Compression & Dynamic Prompt Distillation
As software repositories grow to millions of tokens, simple concatenation causes severe degradation in LLM reasoning. ExtenGen researches **adaptive query-time prompt distillation**—ranking memories by combining dense vector similarity with temporal decay scoring ($S = \text{sim} \cdot e^{-\lambda \Delta t}$).

### 3. Epistemic Multi-Agent Collaboration
When multiple autonomous coding agents work on the same codebase simultaneously, their epistemic state (what each agent knows and assumes) diverges. ExtenGen serves as a shared blackboard (Blackboard Architecture pattern), preventing semantic divergence across parallel agents.

### 4. Privacy-Preserving Tenant Vector Spaces
Researching multi-tenant vector partitioning techniques that guarantee zero information leakage across organizational boundaries while maintaining sub-10ms $k$-NN search performance using HNSW indexes.

---

## 🔮 Future Scope & Roadmap

- [ ] **Autonomous Observation Extraction:** Implement background LLM reflection agents that monitor terminal output and git diffs, automatically extracting architectural decisions without requiring manual tool calls.
- [ ] **Temporal Recency Decay Scoring:** Implement configurable exponential decay functions in `match_observations` to prioritize recent decisions while keeping historical foundations accessible.
- [ ] **Semantic Conflict & Inconsistency Detection:** Automatically alert agents when a new proposal directly contradicts a previously established decision.
- [ ] **Knowledge Graph Integration (Hybrid Graph-RAG):** Combine dense vector embeddings with explicit entity-relationship knowledge graphs (entities: Files, Functions, Modules, PRs, Authors) using Cypher or `pg_graphql`.
- [ ] **IDE Native Extensions:** Develop lightweight VS Code and JetBrains plugins that visualize recalled memories directly in the code editor alongside inline completions.
- [ ] **Local Embedded Engine (SQLite / DuckDB + libsqlite3-vss):** Provide a zero-dependency, single-binary distribution of ExtenGen for offline local development without external PostgreSQL servers.

---

## 📚 References & Academic Citations

ExtenGen's theoretical architecture and implementation are informed by foundational research in autonomous agents, vector indexing, and cognitive retrieval systems:

1. **Model Context Protocol (MCP)**  
   *Anthropic PBC* (2024). *Model Context Protocol Specification*.  
   [https://modelcontextprotocol.io](https://modelcontextprotocol.io)

2. **Generative Agents: Interactive Simulacra of Human Behavior**  
   Park, J. S., O'Brien, J. C., Cai, C. J., Morris, M. R., Liang, P., & Bernstein, M. S. (2023).  
   *arXiv preprint arXiv:2304.03442*.

3. **MemGPT: Towards LLMs as Operating Systems**  
   Packer, C., Fang, V., Patil, S. G., Lin, K., Wooders, S., & Gonzalez, J. E. (2023).  
   *arXiv preprint arXiv:2310.08560*.

4. **Reflexion: Language Agents with Verbal Reinforcement Learning**  
   Shinn, N., Cassano, F., Gopinath, A., Narasimhan, K., & Yao, S. (2023).  
   *Advances in Neural Information Processing Systems (NeurIPS 2023)*.

5. **Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks**  
   Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., ... & Kiela, D. (2020).  
   *Advances in Neural Information Processing Systems (NeurIPS 2020)*.

6. **Efficient and Robust Approximate Nearest Neighbor Search Using Hierarchical Navigable Small World Graphs (HNSW)**  
   Malkov, Y. A., & Yashunin, D. A. (2018).  
   *IEEE Transactions on Pattern Analysis and Machine Intelligence (TPAMI)*.

---

## 🏁 Conclusion & Contributing

**ExtenGen** bridges the fundamental gap between ephemeral AI coding agents and long-term software engineering realities. By providing persistent, multi-tenant, and semantically searchable shared memory, ExtenGen transforms AI assistants from isolated autocomplete tools into continuous, collaborative software engineering partners.

### Contributing
Contributions are welcomed! Please follow these steps:
1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Ensure all tests pass (`npm test`).
4. Commit your changes (`git commit -m 'Add amazing feature'`).
5. Push to the branch (`git push origin feature/amazing-feature`).
6. Open a Pull Request.

---

### License
Distributed under the **MIT License**. See `LICENSE` for more information.

---

<div align="center">
  <sub>Built with ❤️ by the <b>ExtenGen Contributors</b>. Powered by MCP, pgvector, and Fastify.</sub>
</div>
