/**
 * Markdown generation for PR comments and job summaries.
 *
 * Risk-based scoring is the primary view in all modes — every file row leads
 * with a risk label and severity counts. When `AnalysisOptions.numericScoringEnabled`
 * is true, the action layers an additional Quality column onto the table, an
 * Overall Quality Score line into the summary, and a collapsible per-goal
 * breakdown — none of which replaces the risk view.
 */

import { createHash } from "node:crypto";
import { AnalysisResult, AnalysisOptions, IssueCounts } from "../types/index.js";
import { MAX_INLINE_REVIEW_COMMENTS } from "../constants/index.js";
import { formatAgentName } from "./string-utils.js";
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
  return `High: ${counts.high.toString()}, Medium: ${counts.medium.toString()}, Low: ${counts.low.toString()}`;
}

export function generateResultsTable(
  results: AnalysisResult[],
  options: AnalysisOptions,
  context: RepositoryContext,
): string {
  if (results.length === 0) {
    return "No files were analyzed.";
  }

  // Risk is always the primary view. When the org has numeric scoring enabled,
  // we append an additional Quality column rather than replacing risk.
  const showQuality = options.numericScoringEnabled;
  const header = showQuality
    ? `| File | Risk | Issues | Breakdown | Quality |
|:-----|:----:|:------:|:----------|:-------:|`
    : `| File | Risk | Issues | Breakdown |
|:-----|:----:|:------:|:----------|`;

  const rows = results.map((r) => {
    const risk = classifyRisk(r.issueCounts);
    const base = `| ${generateFileDisplayLink(r.filePath, context)} | ${RISK_EMOJI[risk]} ${RISK_LABEL[risk]} | ${r.issueCounts.total.toString()} | ${formatCounts(r.issueCounts)} |`;
    if (!showQuality) return base;
    const score = r.scores?.score;
    const qualityCell =
      typeof score === "number" ? `${getQualityEmoji(score)} ${Math.round(score).toString()}` : "-";
    return `${base} ${qualityCell} |`;
  });

  return `${header}\n${rows.join("\n")}`;
}

/** Unique `path:line` pairs across all anchored issues — i.e., the upper
 * bound on the number of inline review comments the action could post on
 * this run. Issues without a position (line ≤ 0) are excluded since they
 * can't be anchored. */
function countAnchoredIssueLines(results: AnalysisResult[]): number {
  const seen = new Set<string>();
  for (const r of results) {
    for (const i of r.issues) {
      if (i.line > 0) seen.add(`${r.filePath}:${i.line.toString()}`);
    }
  }
  return seen.size;
}

export function generateSummary(results: AnalysisResult[], options: AnalysisOptions): string {
  if (results.length === 0) return "";

  const totals = aggregateCounts(results);
  const risk = aggregateRisk(results);
  const riskLine = `**Overall Risk:** ${RISK_EMOJI[risk]} ${RISK_LABEL[risk]}`;

  let qualityLine = "";
  if (options.numericScoringEnabled) {
    const summary = calculateScoreSummary(results);
    if (summary.filesWithScores > 0) {
      const emoji = getQualityEmoji(summary.averageQualityScore);
      qualityLine = `\n\n**Overall Quality Score:** ${emoji} ${Math.round(summary.averageQualityScore).toString()}`;
    }
  }

  // Inline-review truncation note: when the number of flaggable line groups
  // exceeds MAX_INLINE_REVIEW_COMMENTS, the action can only post the first
  // N as inline comments. Surface the overflow here so reviewers know to
  // check the full `outputs.results` JSON.
  const anchored = countAnchoredIssueLines(results);
  const truncationLine =
    anchored > MAX_INLINE_REVIEW_COMMENTS
      ? `\n\n_Inline reviews are capped at ${MAX_INLINE_REVIEW_COMMENTS.toString()}; ${(anchored - MAX_INLINE_REVIEW_COMMENTS).toString()} additional flagged line(s) are not shown inline — see \`outputs.results\` for the full set._`
      : "";

  return `
## 📊 Summary

${riskLine}${qualityLine}

**Files Analyzed:** ${results.length.toString()}

**Total Issues:** ${totals.total.toString()} (${formatCounts(totals)})${truncationLine}
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

function uniqueAgentsAcrossResults(results: AnalysisResult[]): string[] {
  const seen = new Set<string>();
  for (const r of results) {
    for (const { issue } of r.issues) {
      if (issue.agent) seen.add(formatAgentName(issue.agent));
    }
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

export function generateFooter(
  results: AnalysisResult[],
  options: AnalysisOptions,
  eventType: string,
): string {
  const agents = uniqueAgentsAcrossResults(results);
  const agentLine = agents.length > 0 ? `\n*Agents run: ${agents.join(", ")}*` : "";
  return `
---
*Analysis performed on ${new Date().toLocaleString()}*
*Style Guide: ${options.styleGuideDisplayName}*${agentLine}
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

${generateFooter(results, options, eventType)}
`;
}
