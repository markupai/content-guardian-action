/**
 * Shared fixture builders for AnalysisResult and related shapes.
 */

import type {
  AnalysisIssue,
  AnalysisOptions,
  AnalysisResult,
  IssueCounts,
  IssueSeverity,
  StyleAgentIssue,
  StyleAnalysis,
  StyleScores,
} from "../../src/types/index.js";

export function buildIssue(overrides: Partial<StyleAgentIssue> = {}): StyleAgentIssue {
  return {
    id: "iss_test",
    agent: "style_agent",
    severity: "medium",
    explanation: "Test explanation",
    category: "grammar",
    position: { start: 0, end: 4, text: "Test" },
    suggestion: null,
    suggestions: [],
    guideline_name: "Test guideline",
    context_surface: "Test sentence.",
    read_only: false,
    confidence: 1,
    ...overrides,
  };
}

export function buildAnalysisIssue(overrides: Partial<AnalysisIssue> = {}): AnalysisIssue {
  return {
    issue: buildIssue(),
    line: 1,
    column: 0,
    lineText: "Test sentence.",
    ...overrides,
  };
}

function countsFor(issues: AnalysisIssue[]): IssueCounts {
  const counts: IssueCounts = { total: 0, high: 0, medium: 0, low: 0 };
  for (const { issue } of issues) {
    counts.total += 1;
    counts[issue.severity] += 1;
  }
  return counts;
}

export function buildAnalysisResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  const issues = overrides.issues ?? [];
  return {
    filePath: "README.md",
    workflowId: "agw_test",
    status: "completed",
    documentRef: overrides.filePath ?? "README.md",
    scores: null,
    analysis: null,
    issues,
    issueCounts: overrides.issueCounts ?? countsFor(issues),
    timestamp: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function buildScores(overrides: Partial<StyleScores> = {}): StyleScores {
  return {
    score: 85,
    status: "good",
    ...overrides,
  };
}

export function buildAnalysis(overrides: Partial<StyleAnalysis> = {}): StyleAnalysis {
  return {
    targetId: "tgt_test",
    targetDisplayName: "Test Target",
    words: 100,
    sentences: 10,
    ...overrides,
  };
}

export function buildAnalysisOptions(overrides: Partial<AnalysisOptions> = {}): AnalysisOptions {
  return {
    targetId: "tgt_test",
    targetDisplayName: "Test Target",
    numericScoringEnabled: false,
    ...overrides,
  };
}

export function severities(...list: IssueSeverity[]): AnalysisIssue[] {
  return list.map((severity) => buildAnalysisIssue({ issue: buildIssue({ severity }) }));
}
