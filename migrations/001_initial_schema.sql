-- =============================================================================
-- Migration: 001_initial_schema.sql
-- Description: Core schema for ExtenGen: Multi-tenant organizations, users,
--              api_keys, observations with pgvector embeddings, and RLS policies.
-- =============================================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'admin', 'member', 'agent'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(org_id, email)
);

-- 4. API Keys Table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash VARCHAR(64) UNIQUE NOT NULL,
    key_prefix VARCHAR(16) NOT NULL,
    name VARCHAR(255) NOT NULL,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    scopes TEXT[] NOT NULL DEFAULT ARRAY['read', 'write'],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

-- 5. Observations Table (Persistent Shared Memory)
CREATE TABLE IF NOT EXISTS observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    source VARCHAR(64) NOT NULL DEFAULT 'agent_session', -- 'agent_session', 'github_commit', 'github_pr', 'manual', etc.
    title VARCHAR(255),
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding vector(1536),
    status VARCHAR(32) NOT NULL DEFAULT 'pending_embedding', -- 'pending_embedding', 'indexed', 'failed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Indexes for Performance & Scalability
CREATE INDEX IF NOT EXISTS idx_observations_org_id ON observations(org_id);
CREATE INDEX IF NOT EXISTS idx_observations_user_id ON observations(user_id);
CREATE INDEX IF NOT EXISTS idx_observations_source ON observations(source);
CREATE INDEX IF NOT EXISTS idx_observations_status ON observations(status);
CREATE INDEX IF NOT EXISTS idx_observations_created_at ON observations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_metadata ON observations USING gin(metadata);

-- HNSW Cosine Distance Vector Index (for fast approximate nearest neighbor search)
CREATE INDEX IF NOT EXISTS idx_observations_embedding_hnsw 
ON observations USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 7. Row-Level Security (RLS) Setup
-- Enable RLS on all multi-tenant tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;

-- Helper function to get current org_id from session context
CREATE OR REPLACE FUNCTION get_current_org_id() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_org_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to get current user_id from session context
CREATE OR REPLACE FUNCTION get_current_user_id() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_user_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- RLS Policies for observations
DROP POLICY IF EXISTS observations_tenant_isolation ON observations;
CREATE POLICY observations_tenant_isolation ON observations
    FOR ALL
    USING (
        -- Allow if current session org matches row org, or if bypass is enabled for admin tasks
        org_id = get_current_org_id()
        OR current_setting('app.bypass_rls', true) = 'true'
    )
    WITH CHECK (
        org_id = get_current_org_id()
        OR current_setting('app.bypass_rls', true) = 'true'
    );

-- RLS Policies for users
DROP POLICY IF EXISTS users_tenant_isolation ON users;
CREATE POLICY users_tenant_isolation ON users
    FOR ALL
    USING (
        org_id = get_current_org_id()
        OR current_setting('app.bypass_rls', true) = 'true'
    )
    WITH CHECK (
        org_id = get_current_org_id()
        OR current_setting('app.bypass_rls', true) = 'true'
    );

-- RLS Policies for organizations
DROP POLICY IF EXISTS organizations_tenant_isolation ON organizations;
CREATE POLICY organizations_tenant_isolation ON organizations
    FOR ALL
    USING (
        id = get_current_org_id()
        OR current_setting('app.bypass_rls', true) = 'true'
    );

-- 8. Vector Cosine Similarity Search RPC Function
CREATE OR REPLACE FUNCTION match_observations(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.60,
    match_count int DEFAULT 5,
    filter_sources text[] DEFAULT NULL,
    filter_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    org_id UUID,
    user_id UUID,
    source VARCHAR(64),
    title VARCHAR(255),
    content TEXT,
    metadata JSONB,
    similarity float,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        obs.id,
        obs.org_id,
        obs.user_id,
        obs.source,
        obs.title,
        obs.content,
        obs.metadata,
        (1 - (obs.embedding <=> query_embedding))::float AS similarity,
        obs.created_at
    FROM observations obs
    WHERE obs.embedding IS NOT NULL
      AND obs.status = 'indexed'
      AND (obs.org_id = get_current_org_id() OR current_setting('app.bypass_rls', true) = 'true')
      AND (1 - (obs.embedding <=> query_embedding)) >= match_threshold
      AND (filter_sources IS NULL OR obs.source = ANY(filter_sources))
      AND (filter_user_id IS NULL OR obs.user_id = filter_user_id)
    ORDER BY obs.embedding <=> query_embedding ASC
    LIMIT match_count;
END;
$$;
