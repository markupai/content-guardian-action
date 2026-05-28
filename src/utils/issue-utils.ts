/**
 * Risk-mode issue aggregation utilities.
 *
 * When numeric scoring is disabled, the API returns no scores — so we roll up
 * issue severities into counts and derive an overall risk level from them.
 */

import type { AnalysisIssue, AnalysisResult, IssueCounts, RiskLevel } from "../types/index.js";

export function computeIssueCounts(issues: AnalysisIssue[]): IssueCounts {
  const counts: IssueCounts = { total: 0, high: 0, medium: 0, low: 0 };
  for (const { issue } of issues) {
    counts.total += 1;
    counts[issue.severity] += 1;
  }
  return counts;
}

export function classifyRisk(counts: IssueCounts): RiskLevel {
  if (counts.high > 0) return "high";
  if (counts.medium > 0) return "medium";
  if (counts.low > 0) return "low";
  return "none";
}

export function aggregateCounts(results: AnalysisResult[]): IssueCounts {
  const totals: IssueCounts = { total: 0, high: 0, medium: 0, low: 0 };
  for (const r of results) {
    totals.total += r.issueCounts.total;
    totals.high += r.issueCounts.high;
    totals.medium += r.issueCounts.medium;
    totals.low += r.issueCounts.low;
  }
  return totals;
}

export function aggregateRisk(results: AnalysisResult[]): RiskLevel {
  return classifyRisk(aggregateCounts(results));
}

export const RISK_EMOJI: Record<RiskLevel, string> = {
  high: "🔴",
  medium: "🟡",
  low: "🟢",
  none: "✅",
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "No issues",
};
