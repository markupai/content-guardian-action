/**
 * Main action runner that orchestrates the workflow
 */

import * as core from "@actions/core";
import * as github from "@actions/github";
import {
  getActionConfig,
  getAnalysisOptions,
  logConfiguration,
  validateConfig,
} from "./config/action-config.js";
import { OUTPUT_NAMES } from "./constants/index.js";
import { analyzeFiles, createConfig, getAnalysisSummary } from "./services/api-service.js";
import { handlePostAnalysisActions } from "./services/post-analysis-service.js";
import { createFileDiscoveryStrategy } from "./strategies/index.js";
import { AnalysisResult, EventInfo } from "./types/index.js";
import { logError } from "./utils/error-utils.js";
import {
  displayEventInfo,
  displayFilesToAnalyze,
  displayResults,
  displaySectionHeader,
  filterSupportedFiles,
  readFileContent,
} from "./utils/index.js";

/**
 * Set GitHub Action outputs
 */
function setOutputs(eventInfo: EventInfo, results: AnalysisResult[]): void {
  core.setOutput(OUTPUT_NAMES.EVENT_TYPE, eventInfo.eventType);
  core.setOutput(OUTPUT_NAMES.FILES_ANALYZED, results.length.toString());
  core.setOutput(OUTPUT_NAMES.RESULTS, JSON.stringify(results));
}

/**
 * Display analysis summary
 */
function displaySummary(results: AnalysisResult[]): void {
  const summary = getAnalysisSummary(results);

  displaySectionHeader("📊 Analysis Summary");
  core.info(`📄 Total Files Analyzed: ${summary.totalFiles.toString()}`);
  core.info(`📈 Average Quality Score: ${summary.averageQualityScore.toString()}`);
  core.info(`📝 Average Clarity Score: ${summary.averageClarityScore.toString()}`);
  core.info(`🎭 Average Tone Score: ${summary.averageToneScore.toString()}`);
}

/**
 * Handle errors gracefully
 */
function handleError(error: unknown): void {
  logError(error, "Action execution failed");
  if (error instanceof Error) {
    core.setFailed(error.message);
  } else {
    core.setFailed(`An unexpected error occurred: ${String(error)}`);
  }
}

/**
 * Run the complete action workflow
 */
export async function runAction(): Promise<void> {
  try {
    // Load and validate configuration
    const config = getActionConfig();
    const apiConfig = createConfig(config.apiToken);

    validateConfig(config);
    logConfiguration(config);

    // Initialize file discovery strategy
    displaySectionHeader("🔍 Initializing File Discovery");
    const strategy = createFileDiscoveryStrategy(github.context, config.githubToken);
    const eventInfo = strategy.getEventInfo();

    // Display event information
    displaySectionHeader("📋 Event Analysis");
    displayEventInfo(eventInfo);

    // Discover files to analyze
    displaySectionHeader("🔍 Discovering Files");
    const allFiles = await strategy.getFilesToAnalyze();
    const supportedFiles = filterSupportedFiles(allFiles);

    // Update event info with actual file count
    eventInfo.filesCount = supportedFiles.length;
    core.info(
      `📊 Found ${supportedFiles.length.toString()} supported files out of ${allFiles.length.toString()} total files`,
    );

    if (supportedFiles.length === 0) {
      core.info("No supported files found to analyze.");
      setOutputs(eventInfo, []);
      return;
    }

    // Display files being analyzed
    displayFilesToAnalyze(supportedFiles);

    displaySectionHeader("🔍 Running Analysis");
    const analysisOptions = getAnalysisOptions(config);
    const results = await analyzeFiles(supportedFiles, analysisOptions, apiConfig, readFileContent);

    if (results.length === 0) {
      core.setFailed("Failed to analyze supported files.");
      return;
    }

    // Display results
    displayResults(results);

    // Set outputs
    setOutputs(eventInfo, results);

    // Display summary
    displaySummary(results);

    // Handle post-analysis actions based on event type
    await handlePostAnalysisActions(eventInfo, results, config, analysisOptions);

    if (config.strictMode && results.length !== supportedFiles.length) {
      core.setFailed("Some files were not analyzed.");
      return;
    }
  } catch (error) {
    handleError(error);
  }
}
