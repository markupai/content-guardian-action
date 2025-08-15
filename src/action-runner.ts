/**
 * Main action runner that orchestrates the workflow
 */

import * as core from '@actions/core'
import * as github from '@actions/github'
import { AnalysisResult, EventInfo } from './types/index.js'
import { OUTPUT_NAMES } from './constants/index.js'
import {
  createConfig,
  analyzeFiles,
  getAnalysisSummary
} from './services/api-service.js'
import { createFileDiscoveryStrategy } from './strategies/index.js'
import {
  getActionConfig,
  getAnalysisOptions,
  validateConfig,
  logConfiguration
} from './config/action-config.js'
import { filterSupportedFiles, readFileContent } from './utils/index.js'
import {
  displayEventInfo,
  displayFilesToAnalyze,
  displayResults,
  displaySectionHeader
} from './utils/index.js'
import { logError } from './utils/error-utils.js'
import { handlePostAnalysisActions } from './services/post-analysis-service.js'

/**
 * Set GitHub Action outputs
 */
function setOutputs(eventInfo: EventInfo, results: AnalysisResult[]): void {
  core.setOutput(OUTPUT_NAMES.EVENT_TYPE, eventInfo.eventType)
  core.setOutput(OUTPUT_NAMES.FILES_ANALYZED, results.length.toString())
  core.setOutput(OUTPUT_NAMES.RESULTS, JSON.stringify(results))
}

/**
 * Display analysis summary
 */
function displaySummary(results: AnalysisResult[]): void {
  const summary = getAnalysisSummary(results)

  displaySectionHeader('📊 Analysis Summary')
  core.info(`📄 Total Files Analyzed: ${summary.totalFiles}`)
  core.info(`📈 Average Quality Score: ${summary.averageQualityScore}`)
  core.info(`📝 Average Clarity Score: ${summary.averageClarityScore}`)
  core.info(`🎭 Average Tone Score: ${summary.averageToneScore}`)
}

/**
 * Handle errors gracefully
 */
function handleError(error: unknown): void {
  logError(error, 'Action execution failed')
  if (error instanceof Error) {
    core.setFailed(error.message)
  } else {
    core.setFailed(`An unexpected error occurred: ${String(error)}`)
  }
}

/**
 * Run the complete action workflow
 */
export async function runAction(): Promise<void> {
  try {
    // Load and validate configuration
    const config = getActionConfig()
    const apiConfig = createConfig(config.apiToken)

    validateConfig(config)
    logConfiguration(config)

    // Initialize file discovery strategy
    displaySectionHeader('🔍 Initializing File Discovery')
    const strategy = createFileDiscoveryStrategy(
      github.context,
      config.githubToken
    )
    const eventInfo = strategy.getEventInfo()

    // Display event information
    displaySectionHeader('📋 Event Analysis')
    displayEventInfo(eventInfo)

    // Discover files to analyze
    displaySectionHeader('🔍 Discovering Files')
    const allFiles = await strategy.getFilesToAnalyze()
    const supportedFiles = filterSupportedFiles(allFiles)

    // Update event info with actual file count
    eventInfo.filesCount = supportedFiles.length
    core.info(
      `📊 Found ${supportedFiles.length} supported files out of ${allFiles.length} total files`
    )

    if (supportedFiles.length === 0) {
      core.info('No supported files found to analyze.')
      setOutputs(eventInfo, [])
      return
    }

    // Display files being analyzed
    displayFilesToAnalyze(supportedFiles)

    displaySectionHeader('🔍 Running Analysis')
    const analysisOptions = getAnalysisOptions(config)
    const results = await analyzeFiles(
      supportedFiles,
      analysisOptions,
      apiConfig,
      readFileContent
    )

    // Display results
    displayResults(results)

    // Set outputs
    setOutputs(eventInfo, results)

    // Display summary
    displaySummary(results)

    // Handle post-analysis actions based on event type
    await handlePostAnalysisActions(eventInfo, results, config, analysisOptions)
  } catch (error) {
    handleError(error)
  }
}
