/**
 * Unit tests for post-analysis service
 */

import { jest } from '@jest/globals'
import { buildQuality, buildClarity, buildTone } from './test-helpers/scores.js'
import * as core from '../__fixtures__/core.js'
import type { AnalysisResult } from '../src/types/index.js'

// Spy on core methods
const infoSpy = jest.spyOn(core, 'info')
const errorSpy = jest.spyOn(core, 'error')

// Mock @actions/core and @actions/github
jest.unstable_mockModule('@actions/core', () => core)

const mockGitHubContext = {
  repo: {
    owner: 'test-owner',
    repo: 'test-repo'
  },
  sha: 'abc123def456',
  ref: 'refs/heads/main'
}

jest.unstable_mockModule('@actions/github', () => ({
  context: mockGitHubContext
}))

// Mock dependencies
const mockGetAnalysisSummary = jest.fn() as jest.MockedFunction<
  () => {
    averageQualityScore: number
    averageClarityScore: number
    averageGrammarScore: number
    averageConsistencyScore: number
    averageToneScore: number
    averageTerminologyScore: number
    totalGrammarIssues: number
    totalStyleGuideIssues: number
    totalTerminologyIssues: number
    totalFiles: number
    totalIssues: number
  }
>
const mockCreateGitHubClient = jest.fn() as jest.MockedFunction<
  () => Record<string, unknown>
>
const mockUpdateCommitStatus = jest.fn() as jest.MockedFunction<
  () => Promise<void>
>

const mockIsPullRequestEvent = jest.fn() as jest.MockedFunction<() => boolean>
const mockGetPRNumber = jest.fn() as jest.MockedFunction<() => number | null>
const mockCreateOrUpdatePRComment = jest.fn() as jest.MockedFunction<
  () => Promise<void>
>
const mockDisplaySectionHeader = jest.fn() as jest.MockedFunction<() => void>
const mockCreateJobSummary = jest.fn() as jest.MockedFunction<
  () => Promise<void>
>

jest.unstable_mockModule('../src/services/api-service.js', () => ({
  getAnalysisSummary: mockGetAnalysisSummary
}))

jest.unstable_mockModule('../src/services/github-service.js', () => ({
  createGitHubClient: mockCreateGitHubClient,
  updateCommitStatus: mockUpdateCommitStatus
}))

jest.unstable_mockModule('../src/services/pr-comment-service.js', () => ({
  createOrUpdatePRComment: mockCreateOrUpdatePRComment,
  isPullRequestEvent: mockIsPullRequestEvent,
  getPRNumber: mockGetPRNumber
}))

jest.unstable_mockModule('../src/services/job-summary-service.js', () => ({
  createJobSummary: mockCreateJobSummary
}))

jest.unstable_mockModule('../src/utils/display-utils.js', () => ({
  displaySectionHeader: mockDisplaySectionHeader
}))

// Import the module after mocking
let postAnalysisService: typeof import('../src/services/post-analysis-service.js')
import { EVENT_TYPES } from '../src/constants/index.js'

beforeAll(async () => {
  postAnalysisService = await import('../src/services/post-analysis-service.js')
})

describe('Post Analysis Service', () => {
  // Set up environment variable for GitHub context
  const originalEnv = process.env
  beforeAll(() => {
    process.env.GITHUB_REPOSITORY = 'test-owner/test-repo'
  })

  afterAll(() => {
    process.env = originalEnv
  })

  beforeEach(() => {
    jest.clearAllMocks()
    infoSpy.mockClear()
    errorSpy.mockClear()

    mockGetAnalysisSummary.mockReturnValue({
      averageQualityScore: 85,
      averageClarityScore: 78,
      averageGrammarScore: 90,
      averageConsistencyScore: 88,
      averageToneScore: 82,
      averageTerminologyScore: 95,
      totalGrammarIssues: 2,
      totalStyleGuideIssues: 1,
      totalTerminologyIssues: 0,
      totalFiles: 1,
      totalIssues: 2
    })

    mockCreateGitHubClient.mockReturnValue(mockOctokit)
  })

  const mockOctokit = { rest: {} }
  const mockResults: AnalysisResult[] = [
    {
      filePath: 'test.md',
      result: {
        quality: buildQuality(85, 1, {
          grammarScore: 90,
          grammarIssues: 2,
          styleGuideScore: 88,
          styleGuideIssues: 1,
          terminologyScore: 95,
          terminologyIssues: 0
        }),
        analysis: {
          clarity: buildClarity(78),
          tone: buildTone(82)
        }
      },
      timestamp: '2024-01-15T10:30:00Z'
    }
  ]

  const mockConfig = {
    githubToken: 'test-token',
    addCommitStatus: true
  }

  const mockAnalysisOptions = {
    dialect: 'american_english',
    styleGuide: 'ap'
  }

  describe('handlePostAnalysisActions', () => {
    it('should handle empty results', async () => {
      await postAnalysisService.handlePostAnalysisActions(
        {
          eventType: EVENT_TYPES.PUSH,
          filesCount: 0,
          description: 'Push event'
        },
        [],
        mockConfig,
        mockAnalysisOptions
      )

      expect(infoSpy).toHaveBeenCalledWith(
        'No results to process for post-analysis actions.'
      )
      expect(mockCreateGitHubClient).not.toHaveBeenCalled()
    })

    describe('Push events', () => {
      it('should update commit status when enabled', async () => {
        await postAnalysisService.handlePostAnalysisActions(
          {
            eventType: EVENT_TYPES.PUSH,
            filesCount: 1,
            description: 'Push event'
          },
          mockResults,
          mockConfig,
          mockAnalysisOptions
        )

        expect(mockDisplaySectionHeader).toHaveBeenCalledWith(
          '📊 Updating Commit Status'
        )
        expect(mockUpdateCommitStatus).toHaveBeenCalledWith(
          mockOctokit,
          'test-owner',
          'test-repo',
          'abc123def456',
          85,
          1
        )
      })

      it('should skip commit status when disabled', async () => {
        const configWithDisabledStatus = {
          ...mockConfig,
          addCommitStatus: false
        }

        await postAnalysisService.handlePostAnalysisActions(
          {
            eventType: EVENT_TYPES.PUSH,
            filesCount: 1,
            description: 'Push event'
          },
          mockResults,
          configWithDisabledStatus,
          mockAnalysisOptions
        )

        expect(mockDisplaySectionHeader).not.toHaveBeenCalled()
        expect(mockUpdateCommitStatus).not.toHaveBeenCalled()
        expect(infoSpy).toHaveBeenCalledWith(
          '📊 Commit status update disabled by configuration'
        )
      })
    })

    describe('Workflow dispatch events', () => {
      it('should create job summary for workflow dispatch events', async () => {
        await postAnalysisService.handlePostAnalysisActions(
          {
            eventType: EVENT_TYPES.WORKFLOW_DISPATCH,
            filesCount: 1,
            description: 'Manual workflow'
          },
          mockResults,
          mockConfig,
          mockAnalysisOptions
        )

        expect(mockDisplaySectionHeader).toHaveBeenCalledWith(
          '📋 Creating Job Summary'
        )
        expect(mockCreateJobSummary).toHaveBeenCalledWith(
          mockResults,
          mockAnalysisOptions,
          EVENT_TYPES.WORKFLOW_DISPATCH
        )
      })
    })

    describe('Schedule events', () => {
      it('should create job summary for schedule events', async () => {
        await postAnalysisService.handlePostAnalysisActions(
          {
            eventType: EVENT_TYPES.SCHEDULE,
            filesCount: 1,
            description: 'Scheduled workflow'
          },
          mockResults,
          mockConfig,
          mockAnalysisOptions
        )

        expect(mockDisplaySectionHeader).toHaveBeenCalledWith(
          '📋 Creating Job Summary'
        )
        expect(mockCreateJobSummary).toHaveBeenCalledWith(
          mockResults,
          mockAnalysisOptions,
          EVENT_TYPES.SCHEDULE
        )
      })
    })

    describe('Pull request events', () => {
      it('should create PR comment when it is a pull request event', async () => {
        mockIsPullRequestEvent.mockReturnValue(true)
        mockGetPRNumber.mockReturnValue(123)

        await postAnalysisService.handlePostAnalysisActions(
          {
            eventType: EVENT_TYPES.PULL_REQUEST,
            filesCount: 1,
            description: 'Pull request event'
          },
          mockResults,
          mockConfig,
          mockAnalysisOptions
        )

        expect(mockDisplaySectionHeader).toHaveBeenCalledWith(
          '💬 Creating PR Comment'
        )
        expect(mockCreateOrUpdatePRComment).toHaveBeenCalledWith(mockOctokit, {
          owner: 'test-owner',
          eventType: 'pull_request',
          repo: 'test-repo',
          prNumber: 123,
          results: mockResults,
          config: mockAnalysisOptions
        })
      })

      it('should not create PR comment when it is not a pull request event', async () => {
        mockIsPullRequestEvent.mockReturnValue(false)

        await postAnalysisService.handlePostAnalysisActions(
          {
            eventType: EVENT_TYPES.PULL_REQUEST,
            filesCount: 1,
            description: 'Pull request event'
          },
          mockResults,
          mockConfig,
          mockAnalysisOptions
        )

        expect(mockDisplaySectionHeader).not.toHaveBeenCalled()
        expect(mockCreateOrUpdatePRComment).not.toHaveBeenCalled()
      })

      it('should not create PR comment when PR number is null', async () => {
        mockIsPullRequestEvent.mockReturnValue(true)
        mockGetPRNumber.mockReturnValue(null)

        await postAnalysisService.handlePostAnalysisActions(
          {
            eventType: EVENT_TYPES.PULL_REQUEST,
            filesCount: 1,
            description: 'Pull request event'
          },
          mockResults,
          mockConfig,
          mockAnalysisOptions
        )

        expect(mockDisplaySectionHeader).not.toHaveBeenCalled()
        expect(mockCreateOrUpdatePRComment).not.toHaveBeenCalled()
      })
    })

    describe('Unknown event types', () => {
      it('should log info for unknown event type', async () => {
        await postAnalysisService.handlePostAnalysisActions(
          {
            eventType: 'unknown_event' as string,
            filesCount: 1,
            description: 'Unknown event'
          },
          mockResults,
          mockConfig,
          mockAnalysisOptions
        )

        expect(infoSpy).toHaveBeenCalledWith(
          'No specific post-analysis actions for event type: unknown_event'
        )
        expect(mockDisplaySectionHeader).not.toHaveBeenCalled()
      })
    })

    describe('Error handling', () => {
      it('should handle errors in updateCommitStatus', async () => {
        mockUpdateCommitStatus.mockRejectedValue(
          new Error('Status update failed')
        )

        await postAnalysisService.handlePostAnalysisActions(
          {
            eventType: EVENT_TYPES.PUSH,
            filesCount: 1,
            description: 'Push event'
          },
          mockResults,
          mockConfig,
          mockAnalysisOptions
        )

        expect(mockUpdateCommitStatus).toHaveBeenCalled()
        // The function should not throw, it should handle the error gracefully
      })

      it('should handle errors in createOrUpdatePRComment', async () => {
        mockIsPullRequestEvent.mockReturnValue(true)
        mockGetPRNumber.mockReturnValue(123)
        mockCreateOrUpdatePRComment.mockRejectedValue(
          new Error('Comment creation failed')
        )

        await postAnalysisService.handlePostAnalysisActions(
          {
            eventType: EVENT_TYPES.PULL_REQUEST,
            filesCount: 1,
            description: 'Pull request event'
          },
          mockResults,
          mockConfig,
          mockAnalysisOptions
        )

        expect(mockCreateOrUpdatePRComment).toHaveBeenCalled()
        // The function should not throw, it should handle the error gracefully
      })

      it('should handle errors in createJobSummary', async () => {
        mockCreateJobSummary.mockRejectedValue(
          new Error('Job summary creation failed')
        )

        await postAnalysisService.handlePostAnalysisActions(
          {
            eventType: EVENT_TYPES.WORKFLOW_DISPATCH,
            filesCount: 1,
            description: 'Manual workflow'
          },
          mockResults,
          mockConfig,
          mockAnalysisOptions
        )

        expect(mockCreateJobSummary).toHaveBeenCalled()
        // The function should not throw, it should handle the error gracefully
      })
    })
  })
})
