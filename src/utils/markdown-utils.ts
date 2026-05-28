/**
 * Markdown generation for PR comments and job summaries.
 *
 * Branches on `AnalysisOptions.numericScoringEnabled`:
 * - Numeric on: shows the overall quality score per file plus the per-goal
 *   breakdown if available.
 * - Numeric off: hides all scores. Shows severity counts and a risk label.
 *
 * In both modes the issue-count column is always present.
 */

import { createHash } from "node:crypto";
import { AnalysisResult, AnalysisOptions, IssueCounts } from "../types/index.js";
import { getQualityEmoji, calculateScoreSummary } from "./score-utils.js";
import {
  aggregateCounts,
  aggregateRisk,
  classifyRisk,
  RISK_EMOJI,
  RISK_LABEL,
} from "./issue-utils.js";

interface BaseRepositoryContext {
  owner: string;
  repo: string;
  ref: string;
  baseUrl: URL;
  runId?: number;
}

export interface PRRepositoryContext extends BaseRepositoryContext {
  prNumber: number;
}

export type NonPRRepositoryContext = BaseRepositoryContext;

export type RepositoryContext = PRRepositoryContext | NonPRRepositoryContext;

function generateFileDisplayLink(filePath: string, context: RepositoryContext): string {
  return "prNumber" in context
    ? `[${filePath}](${context.baseUrl.origin}/${context.owner}/${context.repo}/pull/${context.prNumber.toString()}/files#diff-${createHash("sha256").update(filePath).digest("hex")})`
    : `[${filePath}](${context.baseUrl.origin}/${context.owner}/${context.repo}/blob/${context.ref}/${filePath})`;
}

function formatCounts(counts: IssueCounts): string {
  return `H:${counts.high.toString()} M:${counts.medium.toString()} L:${counts.low.toString()}`;
}

export function generateResultsTable(
  results: AnalysisResult[],
  options: AnalysisOptions,
  context: RepositoryContext,
): string {
  if (results.length === 0) {
    return "No files were analyzed.";
  }

  if (options.numericScoringEnabled) {
    const header = `| File | Quality | Issues | Breakdown |
|:-----|:-------:|:------:|:----------|`;
    const rows = results.map((r) => {
      const score = r.scores?.score;
      const qualityCell =
        typeof score === "number"
          ? `${getQualityEmoji(score)} ${Math.round(score).toString()}`
          : "-";
      return `| ${generateFileDisplayLink(r.filePath, context)} | ${qualityCell} | ${r.issueCounts.total.toString()} | ${formatCounts(r.issueCounts)} |`;
    });
    return `${header}\n${rows.join("\n")}`;
  }

  const header = `| File | Risk | Issues | Breakdown |
|:-----|:----:|:------:|:----------|`;
  const rows = results.map((r) => {
    const risk = classifyRisk(r.issueCounts);
    return `| ${generateFileDisplayLink(r.filePath, context)} | ${RISK_EMOJI[risk]} ${RISK_LABEL[risk]} | ${r.issueCounts.total.toString()} | ${formatCounts(r.issueCounts)} |`;
  });
  return `${header}\n${rows.join("\n")}`;
}

export function generateSummary(results: AnalysisResult[], options: AnalysisOptions): string {
  if (results.length === 0) return "";

  const totals = aggregateCounts(results);

  if (options.numericScoringEnabled) {
    const summary = calculateScoreSummary(results);
    const emoji = getQualityEmoji(summary.averageQualityScore);
    return `
## 📊 Summary

**Overall Quality Score:** ${emoji} ${Math.round(summary.averageQualityScore).toString()}

**Files Analyzed:** ${summary.totalFiles.toString()}

**Total Issues:** ${totals.total.toString()} (${formatCounts(totals)})
`;
  }

  const risk = aggregateRisk(results);
  return `
## 📊 Summary

**Overall Risk:** ${RISK_EMOJI[risk]} ${RISK_LABEL[risk]}

**Files Analyzed:** ${results.length.toString()}

**Total Issues:** ${totals.total.toString()} (${formatCounts(totals)})
`;
}

/**
 * Per-goal score breakdown, rendered inside a `<details>` block so the
 * summary table stays compact. Only emitted in numeric mode and only when at
 * least one file has `scoresByGoal` data; otherwise returns an empty string
 * so the caller can interpolate it unconditionally.
 */
export function generatePerGoalDetails(
  results: AnalysisResult[],
  options: AnalysisOptions,
): string {
  if (!options.numericScoringEnabled) return "";

  const rows = results
    .map((r) => {
      const goals = r.scores?.scoresByGoal ?? [];
      if (goals.length === 0) return null;
      const parts = goals
        .map((g) => `${g.displayName} ${Math.round(g.score).toString()}`)
        .join(" · ");
      return `**${r.filePath}** — ${parts}`;
    })
    .filter((line): line is string => line !== null);

  if (rows.length === 0) return "";

  return `
<details>
<summary>Per-goal breakdown</summary>

${rows.join("\n\n")}

</details>
`;
}

export function generateFooter(options: AnalysisOptions, eventType: string): string {
  const scoringMode = options.numericScoringEnabled
    ? "Numeric scoring (0–100)"
    : "Risk-based scoring";
  return `
---
*Analysis performed on ${new Date().toLocaleString()}*
*Target: ${options.targetDisplayName} | Mode: ${scoringMode}*
*Event: ${eventType}*`;
}

export function generateAnalysisContent(
  results: AnalysisResult[],
  options: AnalysisOptions,
  header: string,
  eventType: string,
  context: RepositoryContext,
): string {
  return `${header}

${generateResultsTable(results, options, context)}
${generatePerGoalDetails(results, options)}
${generateSummary(results, options)}

${generateFooter(options, eventType)}
`;
}
