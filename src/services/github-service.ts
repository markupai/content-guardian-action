/**
 * GitHub service for handling API operations
 */

import * as core from "@actions/core";
import * as github from "@actions/github";
import { CommitInfo, FileChange } from "../types/index.js";
import { withRetry, logError } from "../utils/error-utils.js";
import { getQualityStatus } from "../utils/score-utils.js";
import { isValidSHA, isValidQualityScore } from "../utils/type-guards.js";

/**
 * Create GitHub Octokit instance
 */
export function createGitHubClient(token: string): ReturnType<typeof github.getOctokit> {
  return github.getOctokit(token);
}

/**
 * Get commit changes from GitHub API with retry logic
 */
export async function getCommitChanges(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  sha: string,
): Promise<CommitInfo | null> {
  try {
    return await withRetry(
      async () => {
        const response = await octokit.rest.repos.getCommit({
          owner,
          repo,
          ref: sha,
        });

        const commit = response.data;
        const changes: FileChange[] =
          commit.files?.map(
            (file: {
              filename: string;
              status: string;
              additions?: number;
              deletions?: number;
              changes?: number;
              patch?: string;
            }) => ({
              filename: file.filename,
              status: file.status,
              additions: file.additions || 0,
              deletions: file.deletions || 0,
              changes: file.changes || 0,
              patch: file.patch,
            }),
          ) || [];

        return {
          sha: commit.sha,
          message: commit.commit.message,
          author: commit.commit.author?.name || "Unknown",
          date: commit.commit.author?.date || new Date().toISOString(),
          changes,
        };
      },
      undefined,
      `Get commit changes for ${owner}/${repo}@${sha}`,
    );
  } catch (error) {
    logError(error, `Failed to get commit changes for ${owner}/${repo}@${sha}`);
    return null;
  }
}

/**
 * Get files changed in a pull request
 *
 * Uses pagination to fetch all files (up to GitHub's limit of 3000 files).
 * The GitHub API returns 30 files per page by default, but we use 100 per page
 * to reduce the number of API calls needed.
 */
export async function getPullRequestFiles(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<string[]> {
  try {
    return await withRetry(
      async () => {
        core.info(`🔍 Fetching files for PR #${prNumber} in ${owner}/${repo}`);

        const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
          owner,
          repo,
          pull_number: prNumber,
          per_page: 100,
        });

        core.info(`✅ Found ${files.length} files in PR`);
        return files.map((file) => file.filename);
      },
      undefined,
      `Get PR files for #${prNumber} in ${owner}/${repo}`,
    );
  } catch (error) {
    logError(error, `Failed to get PR files for #${prNumber} in ${owner}/${repo}`);
    return [];
  }
}

/**
 * Get all files in repository tree
 */
export async function getRepositoryFiles(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  ref: string = "main",
): Promise<string[]> {
  try {
    return await withRetry(
      async () => {
        const response = await octokit.rest.git.getTree({
          owner,
          repo,
          tree_sha: ref,
          recursive: "true",
        });

        const files: string[] = [];
        if (response.data.tree) {
          for (const item of response.data.tree) {
            if (item.type === "blob" && item.path) {
              files.push(item.path);
            }
          }
        }

        return files;
      },
      undefined,
      `Get repository files for ${owner}/${repo}@${ref}`,
    );
  } catch (error) {
    logError(error, `Failed to get repository files for ${owner}/${repo}@${ref}`);
    return [];
  }
}

/**
 * Get repository information
 */
export async function getRepositoryInfo(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
): Promise<{
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
} | null> {
  try {
    const response = await octokit.rest.repos.get({
      owner,
      repo,
    });

    return {
      name: response.data.name,
      fullName: response.data.full_name,
      description: response.data.description,
      language: response.data.language,
    };
  } catch (error) {
    core.error(`Failed to get repository info: ${error}`);
    return null;
  }
}

/**
 * Update commit status with quality score
 */
export async function updateCommitStatus(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  sha: string,
  qualityScore: number,
  filesAnalyzed: number,
): Promise<void> {
  try {
    // Validate inputs
    if (!owner || !repo || !sha) {
      core.error("Invalid parameters for commit status update");
      return;
    }

    // Validate SHA format using type guard
    if (!isValidSHA(sha)) {
      core.error(`Invalid SHA format: ${sha}`);
      return;
    }

    // Validate quality score using type guard
    if (!isValidQualityScore(qualityScore)) {
      core.error("Quality score must be between 0 and 100");
      return;
    }

    const status = getQualityStatus(qualityScore);
    // const emoji = getQualityEmoji(qualityScore)

    // Create a shorter description that fits within GitHub's 140 character limit
    const description = `Quality: ${qualityScore} | Files: ${filesAnalyzed}`;

    // Build target URL safely
    const serverUrl = github.context.serverUrl || "https://github.com";
    const targetUrl = `${serverUrl}/${owner}/${repo}/actions/runs/${github.context.runId}`;

    core.info(`🔍 Creating commit status for ${owner}/${repo}@${sha}`);
    core.info(`📊 Status: ${status}, Description: "${description}"`);
    core.info(`🔗 Target URL: ${targetUrl}`);
    core.info(`📝 Context: Markup AI`);

    // Try with minimal parameters first
    const statusData = {
      owner,
      repo,
      sha,
      state: status,
      description,
      context: "Markup AI",
    };

    core.info(`📋 Status data: ${JSON.stringify(statusData, null, 2)}`);

    await octokit.rest.repos.createCommitStatus(statusData);

    core.info(`✅ Updated commit status: ${status} - ${description}`);
  } catch (error) {
    core.error(`Failed to update commit status: ${error}`);
    // Log more details about the error
    if (error && typeof error === "object" && "message" in error) {
      core.error(`Error message: ${error.message}`);
    }
  }
}
