/**
 * GitHub service for handling API operations
 */

import * as core from "@actions/core";
import * as github from "@actions/github";
import {
  AnalysisResult,
  AnalysisOptions,
  CommitInfo,
  FileChange,
  IssueCounts,
} from "../types/index.js";
import { withRetry, logError } from "../utils/error-utils.js";
import { getQualityStatus } from "../utils/score-utils.js";
import { aggregateCounts, aggregateRisk, RISK_LABEL } from "../utils/issue-utils.js";
import { isValidSHA } from "../utils/type-guards.js";

export function createGitHubClient(token: string): ReturnType<typeof github.getOctokit> {
  return github.getOctokit(token);
}

export async function getCommitChanges(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  sha: string,
): Promise<CommitInfo | null> {
  try {
    return await withRetry(
      async () => {
        const response = await octokit.rest.repos.getCommit({ owner, repo, ref: sha });
        const commit = response.data;
        const changes: FileChange[] =
          commit.files?.map((file) => ({
            filename: file.filename,
            status: file.status,
            additions: file.additions || 0,
            deletions: file.deletions || 0,
            changes: file.changes || 0,
            patch: file.patch,
          })) ?? [];

        return {
          sha: commit.sha,
          message: commit.commit.message,
          author: commit.commit.author?.name ?? "Unknown",
          date: commit.commit.author?.date ?? new Date().toISOString(),
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

export async function getPullRequestFiles(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<string[]> {
  try {
    return await withRetry(
      async () => {
        core.info(`🔍 Fetching files for PR #${prNumber.toString()} in ${owner}/${repo}`);
        const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
          owner,
          repo,
          pull_number: prNumber,
          per_page: 100,
        });
        core.info(`✅ Found ${files.length.toString()} files in PR`);
        return files.map((file) => file.filename);
      },
      undefined,
      `Get PR files for #${prNumber.toString()} in ${owner}/${repo}`,
    );
  } catch (error) {
    logError(error, `Failed to get PR files for #${prNumber.toString()} in ${owner}/${repo}`);
    return [];
  }
}

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
        for (const item of response.data.tree) {
          if (item.type === "blob" && item.path) {
            files.push(item.path);
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

function riskToState(level: ReturnType<typeof aggregateRisk>): "success" | "failure" | "error" {
  if (level === "high") return "error";
  if (level === "medium") return "failure";
  return "success";
}

function formatCountsShort(counts: IssueCounts): string {
  return `H:${counts.high.toString()} M:${counts.medium.toString()} L:${counts.low.toString()}`;
}

/**
 * Update the commit status. In numeric mode the description leads with the
 * average quality score; in risk mode it leads with the worst-case risk label.
 */
export async function updateCommitStatus(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  sha: string,
  results: AnalysisResult[],
  options: AnalysisOptions,
): Promise<void> {
  try {
    if (!owner || !repo || !sha) {
      core.error("Invalid parameters for commit status update");
      return;
    }
    if (!isValidSHA(sha)) {
      core.error(`Invalid SHA format: ${String(sha)}`);
      return;
    }

    const counts = aggregateCounts(results);
    let state: "success" | "failure" | "error";
    let description: string;

    if (options.numericScoringEnabled) {
      const scores = results
        .map((r) => r.scores?.score)
        .filter((s): s is number => typeof s === "number");
      const avg =
        scores.length === 0
          ? 0
          : Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
      state = getQualityStatus(avg);
      description = `Quality ${Math.round(avg).toString()} | Files ${results.length.toString()} | Issues ${counts.total.toString()} (${formatCountsShort(counts)})`;
    } else {
      const risk = aggregateRisk(results);
      state = riskToState(risk);
      description = `Risk ${RISK_LABEL[risk]} | Files ${results.length.toString()} | Issues ${counts.total.toString()} (${formatCountsShort(counts)})`;
    }

    const serverUrl = github.context.serverUrl || "https://github.com";
    const targetUrl = `${serverUrl}/${owner}/${repo}/actions/runs/${github.context.runId.toString()}`;

    core.info(`📊 Commit status: ${state} - ${description}`);
    await octokit.rest.repos.createCommitStatus({
      owner,
      repo,
      sha,
      state,
      description,
      target_url: targetUrl,
      context: "Markup AI",
    });
    core.info(`✅ Updated commit status: ${state} - ${description}`);
  } catch (error) {
    core.error(`Failed to update commit status: ${String(error)}`);
    if (error && typeof error === "object" && "message" in error) {
      core.error(`Error message: ${String(error.message)}`);
    }
  }
}
