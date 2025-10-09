/**
 * Application constants and configuration
 */

export const SUPPORTED_EXTENSIONS = [".md", ".txt", ".markdown"] as const;

/**
 * Default analysis options
 */
export const DEFAULT_ANALYSIS_OPTIONS = {
  dialect: "american_english",
  tone: "formal",
  styleGuide: "ap",
} as const;

/**
 * Input names for GitHub Actions
 */
export const INPUT_NAMES = {
  MARKUP_AI_API_KEY: "markup_ai_api_key",
  DIALECT: "dialect",
  TONE: "tone",
  STYLE_GUIDE: "style-guide",
  GITHUB_TOKEN: "github_token",
  ADD_COMMIT_STATUS: "add_commit_status",
  STRICT_MODE: "strict_mode",
} as const;

/**
 * Environment variable names
 */
export const ENV_VARS = {
  MARKUP_AI_API_KEY: "MARKUP_AI_API_KEY",
  GITHUB_TOKEN: "GITHUB_TOKEN",
} as const;

/**
 * Output names for GitHub Actions
 */
export const OUTPUT_NAMES = {
  EVENT_TYPE: "event-type",
  FILES_ANALYZED: "files-analyzed",
  RESULTS: "results",
} as const;

/**
 * Event types supported by the action
 */
export const EVENT_TYPES = {
  PUSH: "push",
  PULL_REQUEST: "pull_request",
  WORKFLOW_DISPATCH: "workflow_dispatch",
  SCHEDULE: "schedule",
} as const;

/**
 * Display constants
 */
export const DISPLAY = {
  MAX_FILES_TO_SHOW: 10,
  MAX_ISSUES_TO_SHOW: 5,
  SEPARATOR_LENGTH: 50,
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  API_TOKEN_REQUIRED: "API token is required",
  GITHUB_TOKEN_WARNING: "GitHub token not provided. Cannot fetch commit information.",
  UNSUPPORTED_EVENT: "Unsupported event type: {eventType}. Using push strategy.",
} as const;
