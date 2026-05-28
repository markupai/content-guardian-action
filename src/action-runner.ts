/**
 * Main action runner that orchestrates the workflow
 */

import * as core from "@actions/core";
import * as github from "@actions/github";
import { getActionConfig, logConfiguration, validateConfig } from "./config/action-config.js";
import { OUTPUT_NAMES } from "./constants/index.js";
import { analyzeFiles } from "./services/api-service.js";
import {
  assertStyleAgentEnabled,
  getStyleAgentConfig,
  listStyleAgentTargets,
} from "./services/markup-api-client.js";
import { handlePostAnalysisActions } from "./services/post-analysis-service.js";
import { createFileDiscoveryStrategy } from "./strategies/index.js";
import { resolveTarget } from "./services/target-resolver.js";
import { AnalysisOptions, AnalysisResult, EventInfo } from "./types/index.js";
import { logError } from "./utils/error-utils.js";
import {
  displayEventInfo,
  displayFilesToAnalyze,
  displayResults,
  displaySectionHeader,
  filterSupportedFiles,
  readFileContent,
} from "./utils/index.js";

function setOutputs(eventInfo: EventInfo, results: AnalysisResult[]): void {
  core.setOutput(OUTPUT_NAMES.EVENT_TYPE, eventInfo.eventType);
  core.setOutput(OUTPUT_NAMES.FILES_ANALYZED, results.length.toString());
  core.setOutput(OUTPUT_NAMES.RESULTS, JSON.stringify(results));
}

function handleError(error: unknown): void {
  logError(error, "Action execution failed");
  if (error instanceof Error) {
    core.setFailed(error.message);
  } else {
    core.setFailed(`An unexpected error occurred: ${String(error)}`);
  }
}

export async function runAction(): Promise<void> {
  try {
    const config = getActionConfig();
    validateConfig(config);
    logConfiguration(config);

    // Fetch org config + targets, resolve user input.
    displaySectionHeader("🔌 Connecting to Markup AI");
    const orgConfig = await getStyleAgentConfig(config.apiToken);
    assertStyleAgentEnabled(orgConfig);
    core.info(
      `  Style Agent: ${orgConfig.style_agent} | Numeric Scoring: ${orgConfig.style_agent_numeric_scoring ? "on" : "off"}`,
    );

    const targets = await listStyleAgentTargets(config.apiToken);
    const target = resolveTarget(config.target, targets);
    core.info(`  Target: ${target.display_name} (id: ${target.id})`);

    const analysisOptions: AnalysisOptions = {
      targetId: target.id,
      targetDisplayName: target.display_name,
      numericScoringEnabled: orgConfig.style_agent_numeric_scoring,
    };

    // File discovery
    displaySectionHeader("🔍 Initializing File Discovery");
    const strategy = createFileDiscoveryStrategy(github.context, config.githubToken);
    const eventInfo = strategy.getEventInfo();

    displaySectionHeader("📋 Event Analysis");
    displayEventInfo(eventInfo);

    displaySectionHeader("🔍 Discovering Files");
    const allFiles = await strategy.getFilesToAnalyze();
    const supportedFiles = filterSupportedFiles(allFiles);
    eventInfo.filesCount = supportedFiles.length;
    core.info(
      `📊 Found ${supportedFiles.length.toString()} supported files out of ${allFiles.length.toString()} total files`,
    );

    if (supportedFiles.length === 0) {
      core.info("No supported files found to analyze.");
      setOutputs(eventInfo, []);
      return;
    }

    displayFilesToAnalyze(supportedFiles);

    // Analyze
    displaySectionHeader("🔍 Running Analysis");
    const results = await analyzeFiles(
      config.apiToken,
      supportedFiles,
      analysisOptions,
      readFileContent,
    );

    if (results.length === 0) {
      core.setFailed("Failed to analyze supported files.");
      return;
    }

    displayResults(results, analysisOptions);
    setOutputs(eventInfo, results);

    await handlePostAnalysisActions(eventInfo, results, config, analysisOptions);

    if (config.strictMode && results.length !== supportedFiles.length) {
      core.setFailed("Some files were not analyzed.");
      return;
    }
  } catch (error) {
    handleError(error);
  }
}
