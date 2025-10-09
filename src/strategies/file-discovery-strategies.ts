/**
 * File discovery strategies for different GitHub event types
 */

import * as core from "@actions/core";
import * as github from "@actions/github";
import { FileDiscoveryStrategy, EventInfo } from "../types/index.js";
import {
  createGitHubClient,
  getCommitChanges,
  getPullRequestFiles,
  getRepositoryFiles,
} from "../services/github-service.js";
import { EVENT_TYPES } from "../constants/index.js";

/**
 * Push Event Strategy - Analyze files modified in the push
 */
export function createPushEventStrategy(
  owner: string,
  repo: string,
  sha: string,
  githubToken: string,
): FileDiscoveryStrategy {
  const octokit = createGitHubClient(githubToken);

  return {
    async getFilesToAnalyze(): Promise<string[]> {
      const commit = await getCommitChanges(octokit, owner, repo, sha);
      if (!commit) {
        return [];
      }
      return commit.changes.map((change) => change.filename);
    },

    getEventInfo(): EventInfo {
      return {
        eventType: EVENT_TYPES.PUSH,
        description: "Files modified in push event",
        filesCount: 0, // Will be updated after file discovery
        additionalInfo: {
          commitSha: sha,
        },
      };
    },
  };
}

/**
 * Pull Request Event Strategy - Analyze files changed in the PR
 */
export function createPullRequestEventStrategy(
  owner: string,
  repo: string,
  prNumber: number,
  githubToken: string,
): FileDiscoveryStrategy {
  const octokit = createGitHubClient(githubToken);

  return {
    async getFilesToAnalyze(): Promise<string[]> {
      return await getPullRequestFiles(octokit, owner, repo, prNumber);
    },

    getEventInfo(): EventInfo {
      return {
        eventType: EVENT_TYPES.PULL_REQUEST,
        description: "Files changed in pull request",
        filesCount: 0, // Will be updated after file discovery
        additionalInfo: {
          prNumber: prNumber,
        },
      };
    },
  };
}

/**
 * Manual Workflow Strategy - Analyze all files in repository
 */
export function createManualWorkflowStrategy(
  owner: string,
  repo: string,
  githubToken: string,
  ref: string = "main",
): FileDiscoveryStrategy {
  const octokit = createGitHubClient(githubToken);

  return {
    async getFilesToAnalyze(): Promise<string[]> {
      return await getRepositoryFiles(octokit, owner, repo, ref);
    },

    getEventInfo(): EventInfo {
      return {
        eventType: EVENT_TYPES.WORKFLOW_DISPATCH,
        description: "All files in repository (manual trigger)",
        filesCount: 0, // Will be updated after file discovery
        additionalInfo: {
          ref: ref,
        },
      };
    },
  };
}

/**
 * Factory function to create appropriate strategy based on event type
 */
export function createFileDiscoveryStrategy(
  context: typeof github.context,
  githubToken: string,
): FileDiscoveryStrategy {
  const { eventName } = context;

  switch (eventName) {
    case EVENT_TYPES.PUSH:
      return createPushEventStrategy(
        context.repo.owner,
        context.repo.repo,
        context.sha,
        githubToken,
      );

    case EVENT_TYPES.PULL_REQUEST:
      return createPullRequestEventStrategy(
        context.repo.owner,
        context.repo.repo,
        context.issue.number,
        githubToken,
      );

    case EVENT_TYPES.WORKFLOW_DISPATCH:
    case EVENT_TYPES.SCHEDULE:
      return createManualWorkflowStrategy(context.repo.owner, context.repo.repo, githubToken);

    default:
      // For other events, default to push strategy
      core.warning(`Unsupported event type: ${eventName}. Using push strategy.`);
      return createPushEventStrategy(
        context.repo.owner,
        context.repo.repo,
        context.sha,
        githubToken,
      );
  }
}
