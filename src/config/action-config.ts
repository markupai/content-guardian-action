/**
 * Action configuration and input validation
 */

import * as core from "@actions/core";
import { ActionConfig } from "../types/index.js";
import { INPUT_NAMES, ENV_VARS, ERROR_MESSAGES } from "../constants/index.js";

export function getActionConfig(): ActionConfig {
  const apiToken = getRequiredInput(INPUT_NAMES.MARKUP_AI_API_KEY, ENV_VARS.MARKUP_AI_API_KEY);
  const githubToken = getRequiredInput(INPUT_NAMES.GITHUB_TOKEN, ENV_VARS.GITHUB_TOKEN);
  const target = getRequiredInput(INPUT_NAMES.TARGET, "TARGET");
  const strictMode = getBooleanInput(INPUT_NAMES.STRICT_MODE, false);
  const addCommitStatus = getBooleanInput(INPUT_NAMES.ADD_COMMIT_STATUS, true);
  const addReviewComments = getBooleanInput(INPUT_NAMES.ADD_REVIEW_COMMENTS, true);

  return {
    apiToken,
    githubToken,
    target,
    addCommitStatus,
    addReviewComments,
    strictMode,
  };
}

function getRequiredInput(inputName: string, envVarName: string): string {
  const value = core.getInput(inputName) || process.env[envVarName];
  if (!value) {
    throw new Error(
      `Required input '${inputName}' or environment variable '${envVarName}' is not provided`,
    );
  }
  return value;
}

function getBooleanInput(inputName: string, defaultValue: boolean): boolean {
  const value = core.getInput(inputName) || process.env[inputName.toUpperCase()];
  if (value === undefined || value === "") {
    return defaultValue;
  }
  return value.toLowerCase() === "true";
}

export function validateConfig(config: ActionConfig): void {
  if (!config.apiToken) {
    throw new Error(ERROR_MESSAGES.API_TOKEN_REQUIRED);
  }
  if (!config.githubToken) {
    core.warning(ERROR_MESSAGES.GITHUB_TOKEN_WARNING);
  }
  if (!config.target || config.target.trim().length === 0) {
    throw new Error("Input 'target' cannot be empty");
  }
}

export function logConfiguration(config: ActionConfig): void {
  core.info("🔧 Action Configuration:");
  core.info(`  Target: ${config.target}`);
  core.info(`  API Token: ${config.apiToken ? "[PROVIDED]" : "[MISSING]"}`);
  core.info(`  GitHub Token: ${config.githubToken ? "[PROVIDED]" : "[MISSING]"}`);
  core.info(`  Commit Status: ${config.addCommitStatus ? "enabled" : "disabled"}`);
  core.info(`  Review Comments: ${config.addReviewComments ? "enabled" : "disabled"}`);
  core.info(`  Strict Mode: ${config.strictMode ? "on" : "off"}`);
}
