/**
 * Action configuration and input validation
 */

import * as core from "@actions/core";
import { ActionConfig, AnalysisOptions } from "../types/index.js";
import { INPUT_NAMES, ENV_VARS, ERROR_MESSAGES } from "../constants/index.js";

/**
 * Get and validate action configuration from inputs
 */
export function getActionConfig(): ActionConfig {
  const apiToken = getRequiredInput(INPUT_NAMES.MARKUP_AI_API_KEY, ENV_VARS.MARKUP_AI_API_KEY);
  const githubToken = getRequiredInput(INPUT_NAMES.GITHUB_TOKEN, ENV_VARS.GITHUB_TOKEN);

  const dialect = getRequiredInput(INPUT_NAMES.DIALECT, "DIALECT");
  const tone = getOptionalInput(INPUT_NAMES.TONE);
  const styleGuide = getRequiredInput(INPUT_NAMES.STYLE_GUIDE, "STYLE_GUIDE");
  const strictMode = getBooleanInput(INPUT_NAMES.STRICT_MODE, false);

  const addCommitStatus = getBooleanInput(INPUT_NAMES.ADD_COMMIT_STATUS, true);

  return {
    apiToken,
    githubToken,
    dialect,
    tone,
    styleGuide,
    addCommitStatus,
    strictMode,
  };
}

/**
 * Get analysis options from configuration
 */
export function getAnalysisOptions(config: ActionConfig): AnalysisOptions {
  return {
    dialect: config.dialect,
    tone: config.tone,
    styleGuide: config.styleGuide,
  };
}

/**
 * Get a required input value with fallback to environment variable
 */
function getRequiredInput(inputName: string, envVarName: string): string {
  const value = core.getInput(inputName) || process.env[envVarName];

  if (!value) {
    throw new Error(
      `Required input '${inputName}' or environment variable '${envVarName}' is not provided`,
    );
  }

  return value;
}

/**
 * Get an optional input value with fallback to environment variable and default
 */
function getOptionalInput(inputName: string): string | undefined {
  const value = core.getInput(inputName) || process.env[inputName.toUpperCase()];
  return value === undefined || value === "" ? undefined : value;
}

/**
 * Get a boolean input value with fallback to environment variable and default
 */
function getBooleanInput(inputName: string, defaultValue: boolean): boolean {
  const value = core.getInput(inputName) || process.env[inputName.toUpperCase()];

  if (value === undefined || value === "") {
    return defaultValue;
  }

  return value.toLowerCase() === "true";
}

/**
 * Validate configuration
 */
export function validateConfig(config: ActionConfig): void {
  if (!config.apiToken) {
    throw new Error(ERROR_MESSAGES.API_TOKEN_REQUIRED);
  }

  if (!config.githubToken) {
    core.warning(ERROR_MESSAGES.GITHUB_TOKEN_WARNING);
  }

  // Validate required analysis options
  validateAnalysisOption("dialect", config.dialect);
  validateAnalysisOption("style_guide", config.styleGuide);
}

/**
 * Validate individual analysis option
 */
function validateAnalysisOption(name: string, value: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`Analysis option '${name}' cannot be empty`);
  }
}

/**
 * Log configuration (without sensitive data)
 */
export function logConfiguration(config: ActionConfig): void {
  core.info("🔧 Action Configuration:");
  core.info(`  Dialect: ${config.dialect}`);
  core.info(`  Tone: ${config.tone ?? ""}`);
  core.info(`  Style Guide: ${config.styleGuide}`);
  core.info(`  API Token: ${config.apiToken ? "[PROVIDED]" : "[MISSING]"}`);
  core.info(`  GitHub Token: ${config.githubToken ? "[PROVIDED]" : "[MISSING]"}`);
}
