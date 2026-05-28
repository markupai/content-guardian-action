/**
 * Application constants and configuration
 */

export const SUPPORTED_EXTENSIONS = [
  ".dita",
  ".htm",
  ".html",
  ".markdown",
  ".md",
  ".mdown",
  ".mkd",
  ".text",
  ".txt",
  ".xml",
] as const;

export const API_BASE_URL = "https://api.markup.ai/";
export const INTEGRATION_ID = "markupai-content-guardian-action";

/** Style agent ID — stable platform identifier, not customer-scoped. */
export const STYLE_AGENT_ID = "ag_vYCPHsSQnnJj";

/** Workflow polling */
export const POLL_INTERVAL_MS = 2_000;
export const POLL_TIMEOUT_MS = 300_000;

/** Files analyzed concurrently. Kept low because the style agent's `/run`
 * endpoint is rate limited (10 RPM by default). */
export const MAX_CONCURRENT_FILES = 3;

/** Hard cap on the number of inline review comments the action will post on
 * one PR run. Above this, the PR summary surfaces a "N more" indicator. */
export const MAX_INLINE_REVIEW_COMMENTS = 50;

export const INPUT_NAMES = {
  MARKUP_AI_API_KEY: "markup_ai_api_key",
  TARGET: "target",
  GITHUB_TOKEN: "github_token",
  ADD_COMMIT_STATUS: "add_commit_status",
  ADD_REVIEW_COMMENTS: "add_review_comments",
  STRICT_MODE: "strict_mode",
  PATHS: "paths",
  DRY_RUN: "dry_run",
} as const;

export const ENV_VARS = {
  MARKUP_AI_API_KEY: "MARKUP_AI_API_KEY",
  GITHUB_TOKEN: "GITHUB_TOKEN",
} as const;

export const OUTPUT_NAMES = {
  EVENT_TYPE: "event-type",
  FILES_ANALYZED: "files-analyzed",
  RESULTS: "results",
} as const;

export const EVENT_TYPES = {
  PUSH: "push",
  PULL_REQUEST: "pull_request",
  WORKFLOW_DISPATCH: "workflow_dispatch",
  SCHEDULE: "schedule",
} as const;

export const DISPLAY = {
  MAX_FILES_TO_SHOW: 10,
  MAX_ISSUES_TO_SHOW: 5,
  SEPARATOR_LENGTH: 50,
} as const;

export const ERROR_MESSAGES = {
  API_TOKEN_REQUIRED: "API token is required",
  GITHUB_TOKEN_WARNING: "GitHub token not provided. Cannot fetch commit information.",
  UNSUPPORTED_EVENT: "Unsupported event type: {eventType}. Using push strategy.",
  STYLE_AGENT_DISABLED:
    "Style Agent is not enabled for your organization. Contact Markup AI support to enable it.",
} as const;
