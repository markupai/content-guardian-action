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

  const tableHeader = `| File | Quality | Grammar | Consistency | Terminology | Clarity | Tone |
|:----:|:-------:|:-------:|:-----------:|:-----------:|:-------:|:----:|`;

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

      return `| ${fileDisplay} | ${qualityEmoji} ${Math.round(scores.quality.score).toString()} | ${Math.round(scores.quality.grammar.score).toString()} | ${Math.round(scores.quality.consistency.score).toString()} | ${Math.round(scores.quality.terminology.score).toString()} | ${Math.round(scores.analysis.clarity.score).toString()} | ${toneDisplay} |`;
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
  const toneDisplay = hasToneScore ? Math.round(summary.averageToneScore).toString() : "-";

  return `
## 📊 Summary

**Overall Quality Score:** ${overallQualityEmoji} ${Math.round(summary.averageQualityScore).toString()}

**Files Analyzed:** ${summary.totalFiles.toString()}

| Metric | Average Score |
|:------:|:-------------:|
| Quality | ${Math.round(summary.averageQualityScore).toString()} |
| Grammar | ${Math.round(summary.averageGrammarScore).toString()} |
| Consistency | ${Math.round(summary.averageConsistencyScore).toString()} |
| Terminology | ${Math.round(summary.averageTerminologyScore).toString()} |
| Clarity | ${Math.round(summary.averageClarityScore).toString()} |
| Tone | ${toneDisplay} |
`;
}

/**
 * Generate footer section with metadata
 */
export function generateFooter(config: AnalysisOptions, eventType: string): string {
  return `
---
<details>
<summary>Analysis performed on ${new Date().toLocaleString()}</summary>

*Quality Score Legend: 🟢 80+ | 🟡 60-79 | 🔴 0-59*
*Configuration: Dialect: ${config.dialect} |${config.tone ? ` Tone: ${config.tone} |` : ""} Style Guide: ${config.styleGuide}*
*Event: ${eventType}*
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
  const footer = generateFooter(config, eventType);

  return `${header}

${table}

${summary}

${footer}`;
}
