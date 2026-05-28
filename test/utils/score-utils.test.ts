import { describe, it, expect } from "vitest";
import {
  calculateAverageScore,
  calculateScoreSummary,
  getQualityEmoji,
  getQualityStatus,
  QUALITY_EMOJIS,
} from "../../src/utils/score-utils.js";
import { buildAnalysisResult, buildScores } from "../test-helpers/scores.js";

describe("getQualityStatus", () => {
  it.each([
    [95, "success"],
    [80, "success"],
    [79, "failure"],
    [60, "failure"],
    [59, "error"],
    [0, "error"],
  ])("score %i → %s", (score, expected) => {
    expect(getQualityStatus(score)).toBe(expected);
  });
});

describe("getQualityEmoji", () => {
  it("uses thresholds", () => {
    expect(getQualityEmoji(90)).toBe(QUALITY_EMOJIS.EXCELLENT);
    expect(getQualityEmoji(70)).toBe(QUALITY_EMOJIS.GOOD);
    expect(getQualityEmoji(40)).toBe(QUALITY_EMOJIS.POOR);
  });
});

describe("calculateAverageScore", () => {
  it("averages numeric values", () => {
    expect(calculateAverageScore([10, 20, 30])).toBe(20);
  });

  it("returns 0 for empty", () => {
    expect(calculateAverageScore([])).toBe(0);
  });
});

describe("calculateScoreSummary", () => {
  it("ignores files without scores", () => {
    const summary = calculateScoreSummary([
      buildAnalysisResult({ scores: buildScores({ score: 80 }) }),
      buildAnalysisResult({ scores: null }),
      buildAnalysisResult({ scores: buildScores({ score: 90 }) }),
    ]);
    expect(summary.totalFiles).toBe(3);
    expect(summary.filesWithScores).toBe(2);
    expect(summary.averageQualityScore).toBe(85);
  });

  it("returns zero average when no scores are present", () => {
    const summary = calculateScoreSummary([
      buildAnalysisResult({ scores: null }),
      buildAnalysisResult({ scores: null }),
    ]);
    expect(summary.filesWithScores).toBe(0);
    expect(summary.averageQualityScore).toBe(0);
  });
});
