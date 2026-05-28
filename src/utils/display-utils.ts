/**
 * Console-log formatting for the action run.
 */

import * as core from "@actions/core";
import { AnalysisOptions, AnalysisResult, EventInfo } from "../types/index.js";
import { DISPLAY } from "../constants/index.js";
import { classifyRisk, RISK_EMOJI, RISK_LABEL } from "./issue-utils.js";

export function displayEventInfo(eventInfo: EventInfo): void {
  core.info(`📋 Event Type: ${eventInfo.eventType}`);
  core.info(`📄 Description: ${eventInfo.description}`);
  core.info(`📊 Files to analyze: ${eventInfo.filesCount.toString()}`);

  if (eventInfo.additionalInfo) {
    core.info(`📌 Additional Info:`);
    for (const [key, value] of Object.entries(eventInfo.additionalInfo)) {
      core.info(`   ${key}: ${String(value)}`);
    }
  }
}

function logNumericScores(result: AnalysisResult): void {
  if (!result.scores) return;
  core.info(`📈 Quality Score: ${result.scores.score.toString()}`);
  for (const goal of result.scores.scoresByGoal ?? []) {
    core.info(`   • ${goal.displayName}: ${goal.score.toString()}`);
  }
}

function logRiskLabel(result: AnalysisResult): void {
  const risk = classifyRisk(result.issueCounts);
  core.info(`${RISK_EMOJI[risk]} Risk: ${RISK_LABEL[risk]}`);
}

function logIssueCounts(result: AnalysisResult): void {
  const { total, high, medium, low } = result.issueCounts;
  core.info(
    `⚠️  Issues: ${total.toString()} (H:${high.toString()} M:${medium.toString()} L:${low.toString()})`,
  );
}

function displaySingleResult(result: AnalysisResult, options: AnalysisOptions): void {
  core.info(`\n📄 File: ${result.filePath}`);
  if (options.numericScoringEnabled && result.scores) {
    logNumericScores(result);
  } else {
    logRiskLabel(result);
  }
  logIssueCounts(result);
}

export function displayResults(results: AnalysisResult[], options: AnalysisOptions): void {
  if (results.length === 0) {
    core.info("📊 No analysis results to display.");
    return;
  }

  core.info("📊 Analysis Results:");
  core.info("=".repeat(DISPLAY.SEPARATOR_LENGTH));

  for (const [index, result] of results.entries()) {
    displaySingleResult(result, options);
    if (index < results.length - 1) {
      core.info("─".repeat(DISPLAY.SEPARATOR_LENGTH));
    }
  }
}

export function displayFilesToAnalyze(files: string[]): void {
  if (files.length === 0) {
    core.info("No files found to analyze.");
    return;
  }

  core.info("\n📄 Files to analyze:");
  for (const [index, file] of files.slice(0, DISPLAY.MAX_FILES_TO_SHOW).entries()) {
    core.info(`  ${(index + 1).toString()}. ${file}`);
  }

  if (files.length > DISPLAY.MAX_FILES_TO_SHOW) {
    core.info(`  ... and ${(files.length - DISPLAY.MAX_FILES_TO_SHOW).toString()} more files`);
  }
}

export function displaySectionHeader(title: string): void {
  core.info(`\n${title}`);
  core.info("=".repeat(DISPLAY.SEPARATOR_LENGTH));
}

export function displaySubsectionHeader(title: string): void {
  core.info(`\n${title}`);
  core.info("─".repeat(DISPLAY.SEPARATOR_LENGTH));
}
