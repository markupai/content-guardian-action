/**
 * Post-analysis service for handling actions after analysis
 */

import * as core from '@actions/core'
import * as github from '@actions/github'
import { AnalysisResult, EventInfo } from '../types/index.js'
import { EVENT_TYPES } from '../constants/index.js'
import { getAnalysisSummary } from './api-service.js'
import {
  createOrUpdatePRComment,
  isPullRequestEvent,
  getPRNumber
} from './pr-comment-service.js'
import { createGitHubClient, updateCommitStatus } from './github-service.js'
import { createJobSummary } from './job-summary-service.js'
import { RepositoryContext } from '../utils/markdown-utils.js'
import { getAnalysisOptions } from '../config/action-config.js'
import { displaySectionHeader } from '../utils/display-utils.js'

/**
 * Handle push event: update commit status if enabled
 */
async function handlePushEvent(
  octokit: ReturnType<typeof createGitHubClient>,
  owner: string,
  repo: string,
  summary: ReturnType<typeof getAnalysisSummary>,
  results: AnalysisResult[],
  addCommitStatus: boolean
): Promise<void> {
  if (!addCommitStatus) {
    core.info('📊 Commit status update disabled by configuration')
    return
  }

  displaySectionHeader('📊 Updating Commit Status')
  try {
    await updateCommitStatus(
      octokit,
      owner,
      repo,
      github.context.sha,
      summary.averageQualityScore,
      results.length
    )
  } catch (error) {
    core.error(`Failed to update commit status: ${error}`)
  }
}

/**
 * Handle workflow dispatch or schedule event: create job summary
 */
async function handleWorkflowOrScheduleEvent(
  owner: string,
  repo: string,
  ref: string,
  results: AnalysisResult[],
  analysisOptions: ReturnType<typeof getAnalysisOptions>,
  eventType: string
): Promise<void> {
  displaySectionHeader('📋 Creating Job Summary')
  try {
    const context: RepositoryContext = {
      owner,
      repo,
      ref,
      baseUrl: new URL(github.context.serverUrl)
    }
    await createJobSummary(results, analysisOptions, eventType, context)
  } catch (error) {
    core.error(`Failed to create job summary: ${error}`)
  }
}

/**
 * Handle pull request event: create or update PR comment
 */
async function handlePullRequestEvent(
  octokit: ReturnType<typeof createGitHubClient>,
  owner: string,
  repo: string,
  results: AnalysisResult[],
  analysisOptions: ReturnType<typeof getAnalysisOptions>,
  eventType: string
): Promise<void> {
  if (!isPullRequestEvent()) {
    return
  }

  const prNumber = getPRNumber()
  if (!prNumber) {
    return
  }

  displaySectionHeader('💬 Creating PR Comment')
  try {
    await createOrUpdatePRComment(octokit, {
      owner,
      repo,
      prNumber,
      results,
      config: analysisOptions,
      eventType
    })
  } catch (error) {
    core.error(`Failed to create PR comment: ${error}`)
  }
}

/**
 * Handle post-analysis actions based on event type
 */
export async function handlePostAnalysisActions(
  eventInfo: EventInfo,
  results: AnalysisResult[],
  config: { githubToken: string; addCommitStatus: boolean },
  analysisOptions: ReturnType<typeof getAnalysisOptions>
): Promise<void> {
  if (results.length === 0) {
    core.info('No results to process for post-analysis actions.')
    return
  }

  const summary = getAnalysisSummary(results)
  const octokit = createGitHubClient(config.githubToken)
  const { owner, repo } = github.context.repo
  const ref = github.context.ref

  switch (eventInfo.eventType) {
    case EVENT_TYPES.PUSH:
      await handlePushEvent(
        octokit,
        owner,
        repo,
        summary,
        results,
        config.addCommitStatus
      )
      break
    case EVENT_TYPES.WORKFLOW_DISPATCH:
    case EVENT_TYPES.SCHEDULE:
      await handleWorkflowOrScheduleEvent(
        owner,
        repo,
        ref,
        results,
        analysisOptions,
        eventInfo.eventType
      )
      break
    case EVENT_TYPES.PULL_REQUEST:
      await handlePullRequestEvent(
        octokit,
        owner,
        repo,
        results,
        analysisOptions,
        eventInfo.eventType
      )
      break
    default:
      core.info(
        `No specific post-analysis actions for event type: ${eventInfo.eventType}`
      )
  }
}
