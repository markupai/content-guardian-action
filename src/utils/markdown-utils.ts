/**
 * Markdown generation utility functions for analysis results
 */

import { createHash } from 'crypto'
import { AnalysisResult, AnalysisOptions } from '../types/index.js'
import { getQualityEmoji, calculateScoreSummary } from './score-utils.js'

/**
 * Base repository context with common fields
 */
interface BaseRepositoryContext {
  owner: string
  repo: string
  ref: string
  baseUrl: URL
}

/**
 * Repository context for pull request events
 */
export interface PRRepositoryContext extends BaseRepositoryContext {
  prNumber: number
}

/**
 * Repository context for non-PR events (push, workflow_dispatch, etc.)
 */
export type NonPRRepositoryContext = BaseRepositoryContext

/**
 * Union type for repository context
 */
export type RepositoryContext = PRRepositoryContext | NonPRRepositoryContext

/**
 * Generate file display link based on repository context
 */
function generateFileDisplayLink(
  filePath: string,
  context: RepositoryContext
): string {
  return 'prNumber' in context
    ? // PR context - create diff link
      `[${filePath}](${context.baseUrl.origin}/${context.owner}/${context.repo}/pull/${context.prNumber}/files#diff-${createHash('sha256').update(filePath).digest('hex')})`
    : // Non-PR context - create blob link
      `[${filePath}](${context.baseUrl.origin}/${context.owner}/${context.repo}/blob/${context.ref}/${filePath})`
}

/**
 * Generate markdown table for analysis results
 */
export function generateResultsTable(
  results: AnalysisResult[],
  context: RepositoryContext
): string {
  if (results.length === 0) {
    return 'No files were analyzed.'
  }

  const tableHeader = `| File | Quality | Grammar | Consistency | Terminology | Clarity | Tone |
|------|---------|---------|---------|---------|---------|------|`

  const tableRows = results
    .map((result) => {
      const { filePath, result: scores } = result
      const qualityEmoji = getQualityEmoji(scores.quality.score)
      const toneDisplay =
        typeof scores.analysis.tone?.score === 'number'
          ? String(Math.round(scores.analysis.tone.score))
          : '-'

      // Create clickable file link using repository context
      const fileDisplay = generateFileDisplayLink(filePath, context)

      return `| ${fileDisplay} | ${qualityEmoji} ${Math.round(scores.quality.score)} | ${Math.round(scores.quality.grammar.score)} | ${Math.round(scores.quality.consistency.score)} | ${Math.round(scores.quality.terminology.score)} | ${Math.round(scores.analysis.clarity.score)} | ${toneDisplay} |`
    })
    .join('\n')

  return `${tableHeader}\n${tableRows}`
}

/**
 * Generate summary section
 */
export function generateSummary(results: AnalysisResult[]): string {
  if (results.length === 0) {
    return ''
  }

  const summary = calculateScoreSummary(results)
  const overallQualityEmoji = getQualityEmoji(summary.averageQualityScore)

  return `
## 📊 Summary

**Overall Quality Score:** ${overallQualityEmoji} ${Math.round(summary.averageQualityScore)}

**Files Analyzed:** ${summary.totalFiles}

| Metric | Average Score |
|--------|---------------|
| Quality | ${Math.round(summary.averageQualityScore)} |
| Grammar | ${Math.round(summary.averageGrammarScore)} |
| Consistency | ${Math.round(summary.averageConsistencyScore)} |
| Terminology | ${Math.round(summary.averageTerminologyScore)} |
| Clarity | ${Math.round(summary.averageClarityScore)} |
| Tone | ${Math.round(summary.averageToneScore)} |
`
}

/**
 * Generate footer section with metadata
 */
export function generateFooter(
  config: AnalysisOptions,
  eventType: string
): string {
  return `
---
*Analysis performed on ${new Date().toLocaleString()}*
*Quality Score Legend: 🟢 80+ | 🟡 60-79 | 🔴 0-59*
*Configuration: Dialect: ${config.dialect} |${config.tone ? ` Tone: ${config.tone} |` : ''} Style Guide: ${config.styleGuide}*
*Event: ${eventType}*`
}

/**
 * Generate complete analysis content with customizable header
 */
export function generateAnalysisContent(
  results: AnalysisResult[],
  config: AnalysisOptions,
  header: string,
  eventType: string,
  context: RepositoryContext
): string {
  const table = generateResultsTable(results, context)
  const summary = generateSummary(results)
  const footer = generateFooter(config, eventType)

  return `${header}

${table}

${summary}

${footer}`
}
