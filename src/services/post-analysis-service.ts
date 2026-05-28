/**
 * Post-analysis service for handling actions after analysis
 */

import * as core from "@actions/core";
import * as github from "@actions/github";
import { AnalysisOptions, AnalysisResult, EventInfo } from "../types/index.js";
import { EVENT_TYPES } from "../constants/index.js";
import {
  createOrUpdatePRComment,
  createPRReviewComments,
  isPullRequestEvent,
  getPRNumber,
} from "./pr-comment-service.js";
import { createGitHubClient, updateCommitStatus } from "./github-service.js";
import { createJobSummary } from "./job-summary-service.js";
import { RepositoryContext } from "../utils/markdown-utils.js";
import { displaySectionHeader } from "../utils/display-utils.js";

async function handlePushEvent(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  results: AnalysisResult[],
  options: AnalysisOptions,
  addCommitStatus: boolean,
): Promise<void> {
  if (!addCommitStatus) {
    core.info("📊 Commit status update disabled by configuration");
    return;
  }
  displaySectionHeader("📊 Updating Commit Status");
  try {
    await updateCommitStatus(octokit, owner, repo, github.context.sha, results, options);
  } catch (error) {
    core.error(`Failed to update commit status: ${String(error)}`);
  }
}

async function handleWorkflowOrScheduleEvent(
  owner: string,
  repo: string,
  ref: string,
  results: AnalysisResult[],
  options: AnalysisOptions,
  eventType: string,
): Promise<void> {
  displaySectionHeader("📋 Creating Job Summary");
  try {
    const context: RepositoryContext = {
      owner,
      repo,
      ref,
      baseUrl: new URL(github.context.serverUrl),
      runId: github.context.runId,
    };
    await createJobSummary(results, options, eventType, context);
  } catch (error) {
    core.error(`Failed to create job summary: ${String(error)}`);
  }
}

async function handlePullRequestEvent(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  results: AnalysisResult[],
  options: AnalysisOptions,
  addReviewComments: boolean,
  eventType: string,
): Promise<void> {
  if (!isPullRequestEvent()) return;

  const prNumber = getPRNumber();
  if (!prNumber) return;

  displaySectionHeader("💬 Creating PR Comment");
  try {
    await createOrUpdatePRComment(octokit, {
      owner,
      repo,
      prNumber,
      results,
      options,
      eventType,
    });
    if (addReviewComments) {
      await createPRReviewComments(octokit, {
        owner,
        repo,
        prNumber,
        results,
        options,
        eventType,
      });
    } else {
      core.info("💬 Review comments disabled by configuration");
    }
  } catch (error) {
    core.error(`Failed to create PR comment: ${String(error)}`);
  }
}

export async function handlePostAnalysisActions(
  eventInfo: EventInfo,
  results: AnalysisResult[],
  config: { githubToken: string; addCommitStatus: boolean; addReviewComments: boolean },
  options: AnalysisOptions,
): Promise<void> {
  if (results.length === 0) {
    core.info("No results to process for post-analysis actions.");
    return;
  }

  const octokit = createGitHubClient(config.githubToken);
  const { owner, repo } = github.context.repo;
  const ref = github.context.ref;

  switch (eventInfo.eventType) {
    case EVENT_TYPES.PUSH:
      await handlePushEvent(octokit, owner, repo, results, options, config.addCommitStatus);
      break;
    case EVENT_TYPES.WORKFLOW_DISPATCH:
    case EVENT_TYPES.SCHEDULE:
      await handleWorkflowOrScheduleEvent(owner, repo, ref, results, options, eventInfo.eventType);
      break;
    case EVENT_TYPES.PULL_REQUEST:
      await handlePullRequestEvent(
        octokit,
        owner,
        repo,
        results,
        options,
        config.addReviewComments,
        eventInfo.eventType,
      );
      break;
    default:
      core.info(`No specific post-analysis actions for event type: ${eventInfo.eventType}`);
  }
}
