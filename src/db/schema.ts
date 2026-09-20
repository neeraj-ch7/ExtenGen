export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  org_id: string;
  email: string;
  name?: string | null;
  role: 'admin' | 'member' | 'agent';
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  key_hash: string;
  key_prefix: string;
  name: string;
  org_id: string;
  user_id?: string | null;
  scopes: string[];
  created_at: string;
  last_used_at?: string | null;
}

export type ObservationSource = 
  | 'agent_session' 
  | 'github_commit' 
  | 'github_pr' 
  | 'manual' 
  | 'documentation' 
  | (string & {});

export type ObservationStatus = 'pending_embedding' | 'indexed' | 'failed';

export interface ObservationMetadata {
  tags?: string[];
  repo?: string;
  branch?: string;
  commit_hash?: string;
  pr_number?: number;
  session_id?: string;
  agent_name?: string;
  language?: string;
  file_paths?: string[];
  [key: string]: unknown;
}

export interface Observation {
  id: string;
  org_id: string;
  user_id?: string | null;
  source: ObservationSource;
  title?: string | null;
  content: string;
  metadata: ObservationMetadata;
  embedding?: number[] | null;
  status: ObservationStatus;
  created_at: string;
  updated_at: string;
}

export interface ScoredObservation extends Observation {
  similarity: number;
}

export interface TenantContext {
  orgId: string;
  userId?: string | null;
  role?: string;
  bypassRls?: boolean;
}
