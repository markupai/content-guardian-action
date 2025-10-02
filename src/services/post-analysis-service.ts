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

  // Handle different event types
  switch (eventInfo.eventType) {
    case EVENT_TYPES.PUSH:
      // Update commit status for push events (if enabled)
      if (config.addCommitStatus) {
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
      } else {
        core.info('📊 Commit status update disabled by configuration')
      }
      break

    case EVENT_TYPES.WORKFLOW_DISPATCH:
    case EVENT_TYPES.SCHEDULE:
      // Create job summary for manual/scheduled workflows
      displaySectionHeader('📋 Creating Job Summary')
      try {
        const context: RepositoryContext = {
          owner,
          repo,
          ref,
          baseUrl: new URL(github.context.serverUrl)
        }
        await createJobSummary(
          results,
          analysisOptions,
          eventInfo.eventType,
          context
        )
      } catch (error) {
        core.error(`Failed to create job summary: ${error}`)
      }
      break

    case EVENT_TYPES.PULL_REQUEST:
      // Handle PR comments for pull request events
      if (isPullRequestEvent()) {
        const prNumber = getPRNumber()
        if (prNumber) {
          displaySectionHeader('💬 Creating PR Comment')
          try {
            await createOrUpdatePRComment(octokit, {
              owner,
              repo,
              prNumber,
              results,
              config: analysisOptions,
              eventType: eventInfo.eventType
            })
          } catch (error) {
            core.error(`Failed to create PR comment: ${error}`)
          }
        }
      }
      break

    default:
      core.info(
        `No specific post-analysis actions for event type: ${eventInfo.eventType}`
      )
  }
}
