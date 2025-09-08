/**
 * Display and logging utility functions
 */

import * as core from '@actions/core'
import { AnalysisResult, EventInfo } from '../types/index.js'
import { DISPLAY } from '../constants/index.js'

/**
 * Display event information in a formatted way
 */
export function displayEventInfo(eventInfo: EventInfo): void {
  core.info(`📋 Event Type: ${eventInfo.eventType}`)
  core.info(`📄 Description: ${eventInfo.description}`)
  core.info(`📊 Files to analyze: ${eventInfo.filesCount}`)

  if (eventInfo.additionalInfo) {
    core.info(`📌 Additional Info:`)
    Object.entries(eventInfo.additionalInfo).forEach(([key, value]) => {
      core.info(`   ${key}: ${value}`)
    })
  }
}

/**
 * Display analysis results in a formatted way
 */
export function displayResults(results: AnalysisResult[]): void {
  if (results.length === 0) {
    core.info('📊 No analysis results to display.')
    return
  }

  core.info('📊 Analysis Results:')
  core.info('='.repeat(DISPLAY.SEPARATOR_LENGTH))

  results.forEach((analysis, index) => {
    const { filePath, result } = analysis
    core.info(`\n📄 File: ${filePath}`)
    core.info(`📈 Quality Score: ${result.quality.score}`)
    core.info(`📝 Clarity Score: ${result.analysis.clarity.score}`)
    core.info(`🔤 Grammar Score: ${result.quality.grammar.score}`)
    core.info(`📋 Consistency Score: ${result.quality.consistency.score}`)
    core.info(`🎭 Tone Score: ${result.analysis.tone.score}`)
    core.info(`📚 Terminology Score: ${result.quality.terminology.score}`)

    if (index < results.length - 1) {
      core.info('─'.repeat(DISPLAY.SEPARATOR_LENGTH))
    }
  })
}

/**
 * Display files being analyzed
 */
export function displayFilesToAnalyze(files: string[]): void {
  if (files.length === 0) {
    core.info('No files found to analyze.')
    return
  }

  core.info('\n📄 Files to analyze:')
  files.slice(0, DISPLAY.MAX_FILES_TO_SHOW).forEach((file, index) => {
    core.info(`  ${index + 1}. ${file}`)
  })

  if (files.length > DISPLAY.MAX_FILES_TO_SHOW) {
    core.info(
      `  ... and ${files.length - DISPLAY.MAX_FILES_TO_SHOW} more files`
    )
  }
}

/**
 * Display section header
 */
export function displaySectionHeader(title: string): void {
  core.info(`\n${title}`)
  core.info('='.repeat(DISPLAY.SEPARATOR_LENGTH))
}

/**
 * Display subsection header
 */
export function displaySubsectionHeader(title: string): void {
  core.info(`\n${title}`)
  core.info('─'.repeat(DISPLAY.SEPARATOR_LENGTH))
}
