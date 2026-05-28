/**
 * Action configuration and input validation
 */

import * as core from "@actions/core";
import { ActionConfig } from "../types/index.js";
import { INPUT_NAMES, ENV_VARS } from "../constants/index.js";

export function getActionConfig(): ActionConfig {
  const apiToken = getRequiredInput(INPUT_NAMES.MARKUP_AI_API_KEY, ENV_VARS.MARKUP_AI_API_KEY);
  const githubToken = getRequiredInput(INPUT_NAMES.GITHUB_TOKEN, ENV_VARS.GITHUB_TOKEN);
  // `target` is optional: when omitted, the action falls back to the org's
  // default target (the one flagged `is_default: true` in /style-agent/targets).
  const target = getOptionalInput(INPUT_NAMES.TARGET, "TARGET");
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

function getOptionalInput(inputName: string, envVarName: string): string {
  const value = core.getInput(inputName) || process.env[envVarName] || "";
  return value.trim();
}

function getBooleanInput(inputName: string, defaultValue: boolean): boolean {
  const value = core.getInput(inputName) || process.env[inputName.toUpperCase()];
  if (value === undefined || value === "") {
    return defaultValue;
  }
  return value.toLowerCase() === "true";
}

/**
 * No-op kept for API symmetry with `getActionConfig` / `logConfiguration`.
 * All validation happens at input-read time inside `getActionConfig`
 * (`getRequiredInput` throws for missing api token / github token); `target`
 * is optional. The runner still calls this so future invariants have a
 * natural home.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function validateConfig(config: ActionConfig): void {
  // intentionally empty
}

export function logConfiguration(config: ActionConfig): void {
  core.info("🔧 Action Configuration:");
  core.info(`  Target: ${config.target || "(org default)"}`);
  core.info(`  API Token: ${config.apiToken ? "[PROVIDED]" : "[MISSING]"}`);
  core.info(`  GitHub Token: ${config.githubToken ? "[PROVIDED]" : "[MISSING]"}`);
  core.info(`  Commit Status: ${config.addCommitStatus ? "enabled" : "disabled"}`);
  core.info(`  Review Comments: ${config.addReviewComments ? "enabled" : "disabled"}`);
  core.info(`  Strict Mode: ${config.strictMode ? "on" : "off"}`);
}
