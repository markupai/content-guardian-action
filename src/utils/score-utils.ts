/**
 * Centralized score calculation and quality evaluation utilities
 */

import { StyleScores } from "@markupai/toolkit";

/**
 * Quality score thresholds
 */
export const QUALITY_THRESHOLDS = {
  EXCELLENT: 80,
  GOOD: 60,
  POOR: 0,
} as const;

/**
 * Quality status types
 */
export type QualityStatus = "success" | "failure" | "error";

/**
 * Quality emoji mapping
 */
export const QUALITY_EMOJIS = {
  EXCELLENT: "🟢",
  GOOD: "🟡",
  POOR: "🔴",
} as const;

/**
 * Interface for score summary
 */
export interface ScoreSummary {
  totalFiles: number;
  averageQualityScore: number;
  averageClarityScore: number;
  averageToneScore: number;
  averageGrammarScore: number;
  averageConsistencyScore: number;
  averageTerminologyScore: number;
}

/**
 * Get quality status based on score
 */
export function getQualityStatus(score: number): QualityStatus {
  if (score >= QUALITY_THRESHOLDS.EXCELLENT) return "success";
  if (score >= QUALITY_THRESHOLDS.GOOD) return "failure";
  return "error";
}

/**
 * Get quality emoji based on score
 */
export function getQualityEmoji(score: number): string {
  if (score >= QUALITY_THRESHOLDS.EXCELLENT) return QUALITY_EMOJIS.EXCELLENT;
  if (score >= QUALITY_THRESHOLDS.GOOD) return QUALITY_EMOJIS.GOOD;
  return QUALITY_EMOJIS.POOR;
}

/**
 * Calculate average score from an array of scores
 */
export function calculateAverageScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return Math.round((sum / scores.length) * 100) / 100;
}

/**
 * Calculate comprehensive score summary from analysis results
 */
export function calculateScoreSummary(results: Array<{ result: StyleScores }>): ScoreSummary {
  if (results.length === 0) {
    return {
      totalFiles: 0,
      averageQualityScore: 0,
      averageClarityScore: 0,
      averageToneScore: 0,
      averageGrammarScore: 0,
      averageConsistencyScore: 0,
      averageTerminologyScore: 0,
    };
  }

  const qualityScores = results.map((r) => r.result.quality.score);
  const clarityScores = results.map((r) => r.result.analysis.clarity.score);
  const toneScores = results
    .map((r) => r.result.analysis.tone?.score)
    .filter((score): score is number => typeof score === "number");
  const grammarScores = results.map((r) => r.result.quality.grammar.score);
  const consistencyScores = results.map((r) => r.result.quality.consistency.score);
  const terminologyScores = results.map((r) => r.result.quality.terminology.score);

  return {
    totalFiles: results.length,
    averageQualityScore: calculateAverageScore(qualityScores),
    averageClarityScore: calculateAverageScore(clarityScores),
    averageToneScore: calculateAverageScore(toneScores),
    averageGrammarScore: calculateAverageScore(grammarScores),
    averageConsistencyScore: calculateAverageScore(consistencyScores),
    averageTerminologyScore: calculateAverageScore(terminologyScores),
  };
}
