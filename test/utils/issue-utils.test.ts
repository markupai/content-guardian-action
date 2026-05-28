import { describe, it, expect } from "vitest";
import {
  aggregateCounts,
  aggregateRisk,
  classifyRisk,
  computeIssueCounts,
  RISK_EMOJI,
  RISK_LABEL,
} from "../../src/utils/issue-utils.js";
import { buildAnalysisResult, severities } from "../test-helpers/scores.js";

describe("computeIssueCounts", () => {
  it("rolls up severities", () => {
    const counts = computeIssueCounts(severities("high", "high", "medium", "low", "low", "low"));
    expect(counts).toEqual({ total: 6, high: 2, medium: 1, low: 3 });
  });

  it("returns zeros for empty input", () => {
    expect(computeIssueCounts([])).toEqual({ total: 0, high: 0, medium: 0, low: 0 });
  });
});

describe("classifyRisk", () => {
  it("uses worst severity present", () => {
    expect(classifyRisk({ total: 1, high: 1, medium: 0, low: 0 })).toBe("high");
    expect(classifyRisk({ total: 1, high: 0, medium: 1, low: 0 })).toBe("medium");
    expect(classifyRisk({ total: 1, high: 0, medium: 0, low: 1 })).toBe("low");
    expect(classifyRisk({ total: 0, high: 0, medium: 0, low: 0 })).toBe("none");
  });
});

describe("aggregateCounts", () => {
  it("sums across files", () => {
    const results = [
      buildAnalysisResult({ issueCounts: { total: 2, high: 1, medium: 0, low: 1 } }),
      buildAnalysisResult({ issueCounts: { total: 3, high: 0, medium: 2, low: 1 } }),
    ];
    expect(aggregateCounts(results)).toEqual({ total: 5, high: 1, medium: 2, low: 2 });
  });
});

describe("aggregateRisk", () => {
  it("returns highest severity across files", () => {
    const results = [
      buildAnalysisResult({ issueCounts: { total: 1, high: 0, medium: 0, low: 1 } }),
      buildAnalysisResult({ issueCounts: { total: 1, high: 0, medium: 1, low: 0 } }),
    ];
    expect(aggregateRisk(results)).toBe("medium");
  });
});

describe("RISK_EMOJI/RISK_LABEL", () => {
  it("are exhaustive", () => {
    for (const level of ["high", "medium", "low", "none"] as const) {
      expect(RISK_EMOJI[level]).toBeTruthy();
      expect(RISK_LABEL[level]).toBeTruthy();
    }
  });
});
