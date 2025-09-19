/**
 * Unit tests for display utilities
 */

import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

// Mock @actions/core
jest.unstable_mockModule('@actions/core', () => core)

const {
  displayEventInfo,
  displayResults,
  displayFilesToAnalyze,
  displaySectionHeader,
  displaySubsectionHeader
} = await import('../src/utils/display-utils.js')
import { buildQuality, buildClarity, buildTone } from './test-helpers/scores.js'
import { StyleScores } from '@markupai/toolkit'

describe('Display Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('displayEventInfo', () => {
    it('should display event information correctly', () => {
      const eventInfo = {
        eventType: 'push',
        description: 'Files modified in push event',
        filesCount: 5,
        additionalInfo: {
          commitSha: 'abc123',
          branch: 'main'
        }
      }

      displayEventInfo(eventInfo)

      expect(core.info).toHaveBeenCalledWith('📋 Event Type: push')
      expect(core.info).toHaveBeenCalledWith(
        '📄 Description: Files modified in push event'
      )
      expect(core.info).toHaveBeenCalledWith('📊 Files to analyze: 5')
      expect(core.info).toHaveBeenCalledWith('📌 Additional Info:')
      expect(core.info).toHaveBeenCalledWith('   commitSha: abc123')
      expect(core.info).toHaveBeenCalledWith('   branch: main')
    })

    it('should display event information without additional info', () => {
      const eventInfo = {
        eventType: 'pull_request',
        description: 'Files changed in pull request',
        filesCount: 3
      }

      displayEventInfo(eventInfo)

      expect(core.info).toHaveBeenCalledWith('📋 Event Type: pull_request')
      expect(core.info).toHaveBeenCalledWith(
        '📄 Description: Files changed in pull request'
      )
      expect(core.info).toHaveBeenCalledWith('📊 Files to analyze: 3')
      expect(core.info).not.toHaveBeenCalledWith('📌 Additional Info:')
    })

    it('should handle empty additional info', () => {
      const eventInfo = {
        eventType: 'workflow_dispatch',
        description: 'Manual workflow trigger',
        filesCount: 0,
        additionalInfo: {}
      }

      displayEventInfo(eventInfo)

      expect(core.info).toHaveBeenCalledWith('📋 Event Type: workflow_dispatch')
      expect(core.info).toHaveBeenCalledWith(
        '📄 Description: Manual workflow trigger'
      )
      expect(core.info).toHaveBeenCalledWith('📊 Files to analyze: 0')
      expect(core.info).toHaveBeenCalledWith('📌 Additional Info:')
    })
  })

  describe('displayResults', () => {
    it('should display results for single file', () => {
      const results = [
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

      displayResults(results)

      expect(core.info).toHaveBeenCalledWith('📊 Analysis Results:')
      expect(core.info).toHaveBeenCalledWith('='.repeat(50))
      expect(core.info).toHaveBeenCalledWith('\n📄 File: test.md')
      expect(core.info).toHaveBeenCalledWith('📈 Quality Score: 85')
      expect(core.info).toHaveBeenCalledWith('📝 Clarity Score: 78')
      expect(core.info).toHaveBeenCalledWith('🔤 Grammar Score: 90')
      expect(core.info).toHaveBeenCalledWith('📋 Consistency Score: 88')
      expect(core.info).toHaveBeenCalledWith('🎭 Tone Score: 82')
      expect(core.info).toHaveBeenCalledWith('📚 Terminology Score: 95')
    })

    it('should display results for multiple files', () => {
      const results = [
        {
          filePath: 'file1.md',
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
        },
        {
          filePath: 'file2.md',
          result: {
            quality: buildQuality(92, 1, {
              grammarScore: 88,
              grammarIssues: 2,
              styleGuideScore: 90,
              styleGuideIssues: 1,
              terminologyScore: 93,
              terminologyIssues: 0
            }),
            analysis: {
              clarity: buildClarity(85),
              tone: buildTone(87)
            }
          },
          timestamp: '2024-01-15T10:31:00Z'
        }
      ]

      displayResults(results)

      expect(core.info).toHaveBeenCalledWith('📊 Analysis Results:')
      expect(core.info).toHaveBeenCalledWith('='.repeat(50))

      // First file
      expect(core.info).toHaveBeenCalledWith('\n📄 File: file1.md')
      expect(core.info).toHaveBeenCalledWith('📈 Quality Score: 85')
      expect(core.info).toHaveBeenCalledWith('📝 Clarity Score: 78')
      expect(core.info).toHaveBeenCalledWith('🔤 Grammar Score: 90')
      expect(core.info).toHaveBeenCalledWith('📋 Consistency Score: 88')
      expect(core.info).toHaveBeenCalledWith('🎭 Tone Score: 82')
      expect(core.info).toHaveBeenCalledWith('📚 Terminology Score: 95')

      // Separator
      expect(core.info).toHaveBeenCalledWith('─'.repeat(50))

      // Second file
      expect(core.info).toHaveBeenCalledWith('\n📄 File: file2.md')
      expect(core.info).toHaveBeenCalledWith('📈 Quality Score: 92')
      expect(core.info).toHaveBeenCalledWith('📝 Clarity Score: 85')
      expect(core.info).toHaveBeenCalledWith('🔤 Grammar Score: 88')
      expect(core.info).toHaveBeenCalledWith('📋 Consistency Score: 90')
      expect(core.info).toHaveBeenCalledWith('🎭 Tone Score: 87')
      expect(core.info).toHaveBeenCalledWith('📚 Terminology Score: 93')
    })

    it('should handle empty results array', () => {
      displayResults([])

      expect(core.info).toHaveBeenCalledWith(
        '📊 No analysis results to display.'
      )
      expect(core.info).not.toHaveBeenCalledWith('📊 Analysis Results:')
    })

    it('should not add separator after last file', () => {
      const results = [
        {
          filePath: 'file1.md',
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

      displayResults(results)

      // Should not call separator for single file
      expect(core.info).not.toHaveBeenCalledWith('─'.repeat(50))
    })

    it('should display hyphen for tone when missing', () => {
      const results = [
        {
          filePath: 'file1.md',
          result: {
            quality: buildQuality(85, 1, {
              grammarScore: 90,
              styleGuideScore: 88,
              terminologyScore: 95
            }),
            analysis: {
              clarity: buildClarity(78)
            } as unknown as StyleScores['analysis']
          } as unknown as StyleScores,
          timestamp: '2024-01-15T10:30:00Z'
        }
      ]

      displayResults(results)

      expect(core.info).toHaveBeenCalledWith('🎭 Tone Score: -')
    })
  })

  describe('displayFilesToAnalyze', () => {
    it('should display files within limit', () => {
      const files = ['file1.md', 'file2.txt', 'file3.markdown']

      displayFilesToAnalyze(files)

      expect(core.info).toHaveBeenCalledWith('\n📄 Files to analyze:')
      expect(core.info).toHaveBeenCalledWith('  1. file1.md')
      expect(core.info).toHaveBeenCalledWith('  2. file2.txt')
      expect(core.info).toHaveBeenCalledWith('  3. file3.markdown')
      expect(core.info).not.toHaveBeenCalledWith(
        expect.stringContaining('... and')
      )
    })

    it('should display files with truncation when over limit', () => {
      const files = [
        'file1.md',
        'file2.txt',
        'file3.markdown',
        'file4.md',
        'file5.md',
        'file6.txt',
        'file7.markdown',
        'file8.md',
        'file9.md',
        'file10.txt',
        'file11.markdown',
        'file12.md'
      ]

      displayFilesToAnalyze(files)

      expect(core.info).toHaveBeenCalledWith('\n📄 Files to analyze:')
      expect(core.info).toHaveBeenCalledWith('  1. file1.md')
      expect(core.info).toHaveBeenCalledWith('  2. file2.txt')
      expect(core.info).toHaveBeenCalledWith('  3. file3.markdown')
      expect(core.info).toHaveBeenCalledWith('  4. file4.md')
      expect(core.info).toHaveBeenCalledWith('  5. file5.md')
      expect(core.info).toHaveBeenCalledWith('  6. file6.txt')
      expect(core.info).toHaveBeenCalledWith('  7. file7.markdown')
      expect(core.info).toHaveBeenCalledWith('  8. file8.md')
      expect(core.info).toHaveBeenCalledWith('  9. file9.md')
      expect(core.info).toHaveBeenCalledWith('  10. file10.txt')
      expect(core.info).toHaveBeenCalledWith('  ... and 2 more files')
    })

    it('should handle empty files array', () => {
      displayFilesToAnalyze([])

      expect(core.info).toHaveBeenCalledWith('No files found to analyze.')
      expect(core.info).not.toHaveBeenCalledWith('\n📄 Files to analyze:')
    })

    it('should handle exactly at limit', () => {
      const files = [
        'file1.md',
        'file2.txt',
        'file3.markdown',
        'file4.md',
        'file5.md',
        'file6.txt',
        'file7.markdown',
        'file8.md',
        'file9.md',
        'file10.txt'
      ]

      displayFilesToAnalyze(files)

      expect(core.info).toHaveBeenCalledWith('\n📄 Files to analyze:')
      expect(core.info).toHaveBeenCalledWith('  1. file1.md')
      expect(core.info).toHaveBeenCalledWith('  10. file10.txt')
      expect(core.info).not.toHaveBeenCalledWith(
        expect.stringContaining('... and')
      )
    })
  })

  describe('displaySectionHeader', () => {
    it('should display section header with separator', () => {
      displaySectionHeader('Test Section')

      expect(core.info).toHaveBeenCalledWith('\nTest Section')
      expect(core.info).toHaveBeenCalledWith('='.repeat(50))
    })

    it('should handle empty title', () => {
      displaySectionHeader('')

      expect(core.info).toHaveBeenCalledWith('\n')
      expect(core.info).toHaveBeenCalledWith('='.repeat(50))
    })

    it('should handle long title', () => {
      const longTitle =
        'This is a very long section title that should still work correctly'
      displaySectionHeader(longTitle)

      expect(core.info).toHaveBeenCalledWith(
        '\nThis is a very long section title that should still work correctly'
      )
      expect(core.info).toHaveBeenCalledWith('='.repeat(50))
    })
  })

  describe('displaySubsectionHeader', () => {
    it('should display subsection header with separator', () => {
      displaySubsectionHeader('Test Subsection')

      expect(core.info).toHaveBeenCalledWith('\nTest Subsection')
      expect(core.info).toHaveBeenCalledWith('─'.repeat(50))
    })

    it('should handle empty title', () => {
      displaySubsectionHeader('')

      expect(core.info).toHaveBeenCalledWith('\n')
      expect(core.info).toHaveBeenCalledWith('─'.repeat(50))
    })

    it('should handle long title', () => {
      const longTitle =
        'This is a very long subsection title that should still work correctly'
      displaySubsectionHeader(longTitle)

      expect(core.info).toHaveBeenCalledWith(
        '\nThis is a very long subsection title that should still work correctly'
      )
      expect(core.info).toHaveBeenCalledWith('─'.repeat(50))
    })
  })
})
