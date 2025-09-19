/**
 * Unit tests for score utilities
 */

import { jest } from '@jest/globals'
import { buildQuality, buildClarity, buildTone } from './test-helpers/scores.js'
import { StyleScores } from '@markupai/toolkit'
import * as core from '../__fixtures__/core.js'

// Mock @actions/core
jest.unstable_mockModule('@actions/core', () => core)

const {
  QUALITY_THRESHOLDS,
  getQualityStatus,
  getQualityEmoji,
  calculateAverageScore,
  calculateScoreSummary
} = await import('../src/utils/score-utils.js')

describe('Score Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Constants', () => {
    it('should export quality thresholds', () => {
      expect(QUALITY_THRESHOLDS).toEqual({
        EXCELLENT: 80,
        GOOD: 60,
        POOR: 0
      })
    })
  })

  describe('getQualityStatus', () => {
    it('should return success for scores 80 and above', () => {
      expect(getQualityStatus(95)).toBe('success')
      expect(getQualityStatus(80)).toBe('success')
      expect(getQualityStatus(100)).toBe('success')
    })

    it('should return failure for scores 60-79', () => {
      expect(getQualityStatus(75)).toBe('failure')
      expect(getQualityStatus(60)).toBe('failure')
      expect(getQualityStatus(79)).toBe('failure')
    })

    it('should return error for scores below 60', () => {
      expect(getQualityStatus(55)).toBe('error')
      expect(getQualityStatus(0)).toBe('error')
      expect(getQualityStatus(30)).toBe('error')
    })
  })

  describe('getQualityEmoji', () => {
    it('should return green circle for scores 80 and above', () => {
      expect(getQualityEmoji(95)).toBe('🟢')
      expect(getQualityEmoji(80)).toBe('🟢')
      expect(getQualityEmoji(100)).toBe('🟢')
    })

    it('should return yellow circle for scores 60-79', () => {
      expect(getQualityEmoji(75)).toBe('🟡')
      expect(getQualityEmoji(60)).toBe('🟡')
      expect(getQualityEmoji(79)).toBe('🟡')
    })

    it('should return red circle for scores below 60', () => {
      expect(getQualityEmoji(55)).toBe('🔴')
      expect(getQualityEmoji(0)).toBe('🔴')
      expect(getQualityEmoji(30)).toBe('🔴')
    })
  })

  describe('calculateAverageScore', () => {
    it('should calculate average of quality scores', () => {
      const scores = [85, 90, 75, 95]
      const average = calculateAverageScore(scores)
      expect(average).toBe(86.25)
    })

    it('should handle single score', () => {
      const scores = [85]
      const average = calculateAverageScore(scores)
      expect(average).toBe(85)
    })

    it('should return 0 for empty array', () => {
      const scores: number[] = []
      const average = calculateAverageScore(scores)
      expect(average).toBe(0)
    })

    it('should handle decimal scores', () => {
      const scores = [85.5, 90.25, 75.75]
      const average = calculateAverageScore(scores)
      expect(average).toBe(83.83)
    })

    it('should handle zero scores', () => {
      const scores = [0, 50, 100]
      const average = calculateAverageScore(scores)
      expect(average).toBe(50)
    })
  })

  describe('calculateScoreSummary', () => {
    it('should calculate summary from analysis results', () => {
      const mockResults = [
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
            quality: buildQuality(90, 1, {
              grammarScore: 88,
              grammarIssues: 1,
              styleGuideScore: 92,
              styleGuideIssues: 0,
              terminologyScore: 89,
              terminologyIssues: 1
            }),
            analysis: {
              clarity: buildClarity(85),
              tone: buildTone(87)
            }
          },
          timestamp: '2024-01-15T10:35:00Z'
        }
      ]

      const summary = calculateScoreSummary(mockResults)

      expect(summary).toEqual({
        totalFiles: 2,
        averageQualityScore: 87.5,
        averageClarityScore: 81.5,
        averageToneScore: 84.5,
        averageGrammarScore: 89,
        averageConsistencyScore: 90,
        averageTerminologyScore: 92
      })
    })

    it('should handle empty results array', () => {
      const summary = calculateScoreSummary([])

      expect(summary).toEqual({
        totalFiles: 0,
        averageQualityScore: 0,
        averageClarityScore: 0,
        averageToneScore: 0,
        averageGrammarScore: 0,
        averageConsistencyScore: 0,
        averageTerminologyScore: 0
      })
    })

    it('should handle results with missing optional fields', () => {
      const mockResults = [
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

      const summary = calculateScoreSummary(mockResults)

      expect(summary).toEqual({
        totalFiles: 1,
        averageQualityScore: 85,
        averageClarityScore: 78,
        averageToneScore: 82,
        averageGrammarScore: 90,
        averageConsistencyScore: 88,
        averageTerminologyScore: 95
      })
    })

    it('should ignore tone in averages if tone is missing', () => {
      const mockResults = [
        {
          filePath: 'file1.md',
          result: {
            quality: buildQuality(80),
            analysis: {
              clarity: buildClarity(70)
            } as unknown as StyleScores['analysis']
          } as unknown as StyleScores,
          timestamp: '2024-01-15T10:30:00Z'
        },
        {
          filePath: 'file2.md',
          result: {
            quality: buildQuality(90),
            analysis: {
              clarity: buildClarity(85),
              tone: buildTone(87)
            }
          },
          timestamp: '2024-01-15T10:35:00Z'
        }
      ]

      const summary = calculateScoreSummary(
        mockResults as unknown as Array<{ result: StyleScores }>
      )

      // Tone average should be only over available tone scores => 87
      expect(summary.averageToneScore).toBe(87)
      // Other metrics still average across all files
      expect(summary.averageQualityScore).toBe(85)
      expect(summary.averageClarityScore).toBe(77.5)
    })

    it('should handle single result', () => {
      const mockResults = [
        {
          filePath: 'file1.md',
          result: {
            quality: {
              score: 85,
              grammar: { score: 90, issues: 2 },
              consistency: { score: 88, issues: 1 },
              style_guide: { score: 88, issues: 1 },
              terminology: { score: 95, issues: 0 }
            },
            analysis: {
              clarity: {
                score: 78,
                word_count: 100,
                sentence_count: 5,
                average_sentence_length: 20,
                flesch_reading_ease: 70,
                vocabulary_complexity: 0.5,
                sentence_complexity: 0.4
              },
              tone: {
                score: 82,
                informality: 0,
                liveliness: 0,
                informality_alignment: 0,
                liveliness_alignment: 0
              }
            }
          },
          timestamp: '2024-01-15T10:30:00Z'
        }
      ]

      const summary = calculateScoreSummary(mockResults)

      expect(summary).toEqual({
        totalFiles: 1,
        averageQualityScore: 85,
        averageClarityScore: 78,
        averageToneScore: 82,
        averageGrammarScore: 90,
        averageConsistencyScore: 88,
        averageTerminologyScore: 95
      })
    })

    it('should handle decimal scores correctly', () => {
      const mockResults = [
        {
          filePath: 'file1.md',
          result: {
            quality: buildQuality(85.5, 1, {
              grammarScore: 90.75,
              grammarIssues: 2,
              styleGuideScore: 88.5,
              styleGuideIssues: 1,
              terminologyScore: 95.75,
              terminologyIssues: 0
            }),
            analysis: {
              clarity: buildClarity(78.25),
              tone: buildTone(82.25)
            }
          },
          timestamp: '2024-01-15T10:30:00Z'
        }
      ]

      const summary = calculateScoreSummary(mockResults)

      expect(summary).toEqual({
        totalFiles: 1,
        averageQualityScore: 85.5,
        averageClarityScore: 78.25,
        averageToneScore: 82.25,
        averageGrammarScore: 90.75,
        averageConsistencyScore: 88.5,
        averageTerminologyScore: 95.75
      })
    })
  })
})
