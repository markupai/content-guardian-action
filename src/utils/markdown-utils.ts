/**
 * Markdown generation utility functions for analysis results
 */

import { createHash } from "node:crypto";
import { AnalysisResult, AnalysisOptions } from "../types/index.js";
import { getQualityEmoji, calculateScoreSummary } from "./score-utils.js";

/**
 * Base repository context with common fields
 */
interface BaseRepositoryContext {
  owner: string;
  repo: string;
  ref: string;
  baseUrl: URL;
  runId?: number;
}

/**
 * Repository context for pull request events
 */
export interface PRRepositoryContext extends BaseRepositoryContext {
  prNumber: number;
}

/**
 * Repository context for non-PR events (push, workflow_dispatch, etc.)
 */
export type NonPRRepositoryContext = BaseRepositoryContext;

/**
 * Union type for repository context
 */
export type RepositoryContext = PRRepositoryContext | NonPRRepositoryContext;

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Generate file display link based on repository context
 */
function generateFileDisplayLink(filePath: string, context: RepositoryContext): string {
  return "prNumber" in context
    ? // PR context - create diff link
      `[${filePath}](${context.baseUrl.origin}/${context.owner}/${context.repo}/pull/${context.prNumber.toString()}/files#diff-${createHash("sha256").update(filePath).digest("hex")})`
    : // Non-PR context - create blob link
      `[${filePath}](${context.baseUrl.origin}/${context.owner}/${context.repo}/blob/${context.ref}/${filePath})`;
}

/**
 * Generate markdown table for analysis results
 */
export function generateResultsTable(
  results: AnalysisResult[],
  context: RepositoryContext,
): string {
  if (results.length === 0) {
    return "No files were analyzed.";
  }

  const hasToneScore = results.some(
    (result) => typeof result.result.analysis.tone?.score === "number",
  );
  const tableHeader = hasToneScore
    ? `| File | Quality | Grammar | Consistency | Terminology | Clarity | Tone | Issues |
|:-----|:-------:|:-------:|:-----------:|:-----------:|:-------:|:----:|:------:|`
    : `| File | Quality | Grammar | Consistency | Terminology | Clarity | Issues |
|:-----|:-------:|:-------:|:-----------:|:-----------:|:-------:|:------:|`;

  const tableRows = results
    .map((result) => {
      const { filePath, result: scores } = result;
      const qualityEmoji = getQualityEmoji(scores.quality.score);
      const toneDisplay =
        typeof scores.analysis.tone?.score === "number"
          ? String(Math.round(scores.analysis.tone.score))
          : "-";

      // Create clickable file link using repository context
      const fileDisplay = generateFileDisplayLink(filePath, context);

      const issuesCount = result.issues.length;
      return hasToneScore
        ? `| ${fileDisplay} | ${qualityEmoji} ${Math.round(scores.quality.score).toString()} | ${Math.round(scores.quality.grammar.score).toString()} | ${Math.round(scores.quality.consistency.score).toString()} | ${Math.round(scores.quality.terminology.score).toString()} | ${Math.round(scores.analysis.clarity.score).toString()} | ${toneDisplay} | ${issuesCount.toString()} |`
        : `| ${fileDisplay} | ${qualityEmoji} ${Math.round(scores.quality.score).toString()} | ${Math.round(scores.quality.grammar.score).toString()} | ${Math.round(scores.quality.consistency.score).toString()} | ${Math.round(scores.quality.terminology.score).toString()} | ${Math.round(scores.analysis.clarity.score).toString()} | ${issuesCount.toString()} |`;
    })
    .join("\n");

  return `${tableHeader}\n${tableRows}`;
}

/**
 * Generate summary section
 */
export function generateSummary(results: AnalysisResult[]): string {
  if (results.length === 0) {
    return "";
  }

  const summary = calculateScoreSummary(results);
  const overallQualityEmoji = getQualityEmoji(summary.averageQualityScore);
  const hasToneScore = results.some(
    (result) => typeof result.result.analysis.tone?.score === "number",
  );
  const toneRow = hasToneScore
    ? `| Tone | ${Math.round(summary.averageToneScore).toString()} |`
    : "";

  return `
## 📊 Summary

**Overall Quality Score:** ${overallQualityEmoji} ${Math.round(summary.averageQualityScore).toString()}

**Files Analyzed:** ${summary.totalFiles.toString()}

| Metric | Average Score |
|:------|:-------------:|
| Quality | ${Math.round(summary.averageQualityScore).toString()} |
| Grammar | ${Math.round(summary.averageGrammarScore).toString()} |
| Consistency | ${Math.round(summary.averageConsistencyScore).toString()} |
| Terminology | ${Math.round(summary.averageTerminologyScore).toString()} |
| Clarity | ${Math.round(summary.averageClarityScore).toString()} |
${toneRow}
`;
}

/**
 * Generate footer section with metadata
 */
export function generateFooter(
  config: AnalysisOptions,
  eventType: string,
  context: RepositoryContext,
  results: AnalysisResult[],
): string {
  const workflowRunId = typeof context.runId === "number" ? context.runId.toString() : "";
  const workflowRunLink = workflowRunId
    ? `[#${workflowRunId}](${context.baseUrl.origin}/${context.owner}/${context.repo}/actions/runs/${workflowRunId})`
    : "";
  const workflowIds = Array.from(
    new Set(results.map((result) => result.workflowId).filter(isNonEmptyString)),
  );
  let workflowIdLine = "";
  if (workflowIds.length === 1) {
    workflowIdLine = `- **Markup AI workflow ID:** ${workflowIds[0]}`;
  } else if (workflowIds.length > 1) {
    workflowIdLine = `- **Markup AI workflow IDs:** ${workflowIds.join(", ")}`;
  }
  return `
---
<details>
<summary>💡 Analysis performed on ${new Date().toLocaleString()} - Click to expand</summary>

- **Configuration:** Style Guide: ${config.styleGuide} | Dialect: ${config.dialect}${config.tone ? ` | Tone: ${config.tone}` : ""}
- **Event:** ${eventType}
${workflowRunLink ? `- **GitHub workflow run:** ${workflowRunLink}` : ""}
${workflowIdLine}

</details>`;
}

/**
 * Generate complete analysis content with customizable header
 */
export function generateAnalysisContent(
  results: AnalysisResult[],
  config: AnalysisOptions,
  header: string,
  eventType: string,
  context: RepositoryContext,
): string {
  const table = generateResultsTable(results, context);
  const summary = generateSummary(results);
  const footer = generateFooter(config, eventType, context, results);
  const qualityLegend = "*Quality Score Legend: 🟢 80+ | 🟡 60-79 | 🔴 0-59*";

  return `${header}

${table}

${summary}

${footer}

${qualityLegend}`;
}
