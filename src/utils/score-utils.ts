/**
 * Numeric-score helpers (active only when org-level numeric scoring is enabled).
 */

import type { AnalysisResult } from "../types/index.js";

export const QUALITY_THRESHOLDS = {
  EXCELLENT: 80,
  GOOD: 60,
  POOR: 0,
} as const;

export type QualityStatus = "success" | "failure" | "error";

export const QUALITY_EMOJIS = {
  EXCELLENT: "🟢",
  GOOD: "🟡",
  POOR: "🔴",
} as const;

export function getQualityStatus(score: number): QualityStatus {
  if (score >= QUALITY_THRESHOLDS.EXCELLENT) return "success";
  if (score >= QUALITY_THRESHOLDS.GOOD) return "failure";
  return "error";
}

export function getQualityEmoji(score: number): string {
  if (score >= QUALITY_THRESHOLDS.EXCELLENT) return QUALITY_EMOJIS.EXCELLENT;
  if (score >= QUALITY_THRESHOLDS.GOOD) return QUALITY_EMOJIS.GOOD;
  return QUALITY_EMOJIS.POOR;
}

export function calculateAverageScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return Math.round((sum / scores.length) * 100) / 100;
}

export interface ScoreSummary {
  totalFiles: number;
  averageQualityScore: number;
  filesWithScores: number;
}

export function calculateScoreSummary(results: AnalysisResult[]): ScoreSummary {
  const qualityScores = results
    .map((r) => r.scores?.score)
    .filter((s): s is number => typeof s === "number");
  return {
    totalFiles: results.length,
    averageQualityScore: calculateAverageScore(qualityScores),
    filesWithScores: qualityScores.length,
  };
}
