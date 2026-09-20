import { TenantContext } from '../db/schema.js';
import { storeObservation } from './observations.js';

export interface GitHubCommitItem {
  hash: string;
  message: string;
  author: string;
  date?: string;
  filesChanged?: string[];
}

export interface GitHubPullRequestItem {
  number: number;
  title: string;
  body: string;
  author: string;
  mergedAt?: string;
  baseBranch?: string;
  headBranch?: string;
}

export interface IngestGitHubRepoInput {
  repo: string; // e.g. "owner/repo"
  branch?: string;
  commits?: GitHubCommitItem[];
  pullRequests?: GitHubPullRequestItem[];
  githubToken?: string;
}

/**
 * Ingest GitHub Commits and PRs into ExtenGen memory store.
 */
export async function ingestGitHubRepo(
  tenant: TenantContext,
  input: IngestGitHubRepoInput
): Promise<{ ingestedCommits: number; ingestedPRs: number; observationIds: string[] }> {
  const { repo, branch = 'main', commits = [], pullRequests = [] } = input;
  const observationIds: string[] = [];

  // Ingest Commits
  for (const commit of commits) {
    const title = `GitHub Commit: ${repo} - ${commit.hash.slice(0, 7)}`;
    const content = `Repository: ${repo} (branch: ${branch})\nCommit: ${commit.hash}\nAuthor: ${commit.author}\nMessage: ${commit.message}${
      commit.filesChanged && commit.filesChanged.length > 0
        ? `\nFiles Changed:\n- ${commit.filesChanged.join('\n- ')}`
        : ''
    }`;

    const obs = await storeObservation(tenant, {
      content,
      title,
      source: 'github_commit',
      tags: ['github', 'commit', repo, branch],
      metadata: {
        repo,
        branch,
        commit_hash: commit.hash,
        author: commit.author,
        file_paths: commit.filesChanged,
      },
      immediateEmbed: true, // Immediate vector index for batch ingest
    });

    observationIds.push(obs.id);
  }

  // Ingest Pull Requests
  for (const pr of pullRequests) {
    const title = `GitHub PR #${pr.number}: ${pr.title}`;
    const content = `Repository: ${repo}\nPR #${pr.number}: ${pr.title}\nAuthor: ${pr.author}\nMerged into: ${pr.baseBranch || 'main'}\nDescription:\n${pr.body}`;

    const obs = await storeObservation(tenant, {
      content,
      title,
      source: 'github_pr',
      tags: ['github', 'pull_request', repo],
      metadata: {
        repo,
        pr_number: pr.number,
        author: pr.author,
        base_branch: pr.baseBranch,
        head_branch: pr.headBranch,
      },
      immediateEmbed: true,
    });

    observationIds.push(obs.id);
  }

  return {
    ingestedCommits: commits.length,
    ingestedPRs: pullRequests.length,
    observationIds,
  };
}

/**
 * Fetch commits and PRs directly from GitHub REST API if token provided
 */
export async function fetchAndIngestFromGitHubAPI(
  tenant: TenantContext,
  repo: string,
  token?: string,
  limit = 10
): Promise<{ ingestedCommits: number; ingestedPRs: number; observationIds: string[] }> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'ExtenGen-Shared-Memory-Agent',
  };

  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  const commits: GitHubCommitItem[] = [];
  const pullRequests: GitHubPullRequestItem[] = [];

  try {
    // 1. Fetch commits
    const commitsRes = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=${limit}`, { headers });
    if (commitsRes.ok) {
      const commitData = await commitsRes.json() as any[];
      for (const item of commitData) {
        commits.push({
          hash: item.sha,
          message: item.commit.message,
          author: item.commit.author?.name || item.author?.login || 'unknown',
          date: item.commit.author?.date,
        });
      }
    }

    // 2. Fetch merged PRs
    const prsRes = await fetch(`https://api.github.com/repos/${repo}/pulls?state=closed&per_page=${limit}`, { headers });
    if (prsRes.ok) {
      const prData = await prsRes.json() as any[];
      for (const item of prData) {
        if (item.merged_at) {
          pullRequests.push({
            number: item.number,
            title: item.title,
            body: item.body || '',
            author: item.user?.login || 'unknown',
            mergedAt: item.merged_at,
            baseBranch: item.base?.ref,
            headBranch: item.head?.ref,
          });
        }
      }
    }
  } catch (error) {
    console.warn(`Could not fetch from GitHub API for ${repo}:`, error);
  }

  return ingestGitHubRepo(tenant, {
    repo,
    commits,
    pullRequests,
  });
}
