/**
 * Direct client for the Markup AI agentic API.
 *
 * Replaces `@markupai/toolkit`. Calls `https://api.markup.ai/` via `fetch`,
 * runs the style agent (workflow id ag_vYCPHsSQnnJj) and polls workflow
 * status until terminal.
 */

import * as core from "@actions/core";
import {
  API_BASE_URL,
  INTEGRATION_ID,
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
  STYLE_AGENT_ID,
  ERROR_MESSAGES,
} from "../constants/index.js";
import type {
  AgentRunRequest,
  AgentRunResponse,
  OrganizationConfigResponse,
  StyleGuide,
  WorkflowStatus,
} from "../types/index.js";

export class MarkupApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly requestId?: string,
    public readonly body?: unknown,
    /** Parsed `Retry-After` HTTP header value, in seconds, when present. */
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "MarkupApiError";
  }
}

interface RequestOptions {
  method: "GET" | "POST" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path.replace(/^\//, ""), API_BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

function extractMessage(body: unknown, fallback: string): { message: string; requestId?: string } {
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    const detail = typeof obj.detail === "string" ? obj.detail : undefined;
    const message = typeof obj.message === "string" ? obj.message : undefined;
    const errorField = typeof obj.error === "string" ? obj.error : undefined;
    const requestId = typeof obj.request_id === "string" ? obj.request_id : undefined;
    return { message: detail ?? message ?? errorField ?? fallback, requestId };
  }
  return { message: fallback };
}

interface RequestResult<T> {
  body: T;
  retryAfterSeconds?: number;
}

async function request<T>(apiKey: string, options: RequestOptions): Promise<RequestResult<T>> {
  const url = buildUrl(options.path, options.query);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "x-integration-id": INTEGRATION_ID,
    Accept: "application/json",
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method: options.method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  let parsed: unknown = undefined;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  // Capture Retry-After on every response — it's almost always set on 429,
  // sometimes on 503, and occasionally on 2xx (advisory). Threaded through
  // both the error path and the success path so waitForRateLimit can honor it.
  const retryAfterHeader = response.headers.get("retry-after");
  const retryAfterRaw = retryAfterHeader === null ? NaN : Number(retryAfterHeader);
  const retryAfterSeconds = Number.isFinite(retryAfterRaw) ? retryAfterRaw : undefined;

  if (!response.ok) {
    const { message, requestId } = extractMessage(
      parsed,
      `${options.method} ${options.path} failed with ${response.status.toString()}`,
    );
    throw new MarkupApiError(message, response.status, requestId, parsed, retryAfterSeconds);
  }

  return { body: parsed as T, retryAfterSeconds };
}

const DEFAULT_RATE_LIMIT_BACKOFF_MS = 6_500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickNumber(obj: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function parseRetryAfter(error: MarkupApiError): number | undefined {
  // HTTP Retry-After header (in seconds) takes priority over body fields.
  if (typeof error.retryAfterSeconds === "number") {
    return error.retryAfterSeconds * 1000;
  }
  const body = error.body;
  if (!body || typeof body !== "object") return undefined;
  const seconds = pickNumber(body as Record<string, unknown>, "retry_after", "retry_after_seconds");
  return seconds === undefined ? undefined : seconds * 1000;
}

const MAX_RATE_LIMIT_RETRIES = 2;
const MAX_TRANSIENT_RETRIES = 1;

function isRateLimit(error: unknown): error is MarkupApiError {
  return error instanceof MarkupApiError && error.status === 429;
}

function isRetryableTransient(error: unknown): boolean {
  if (error instanceof MarkupApiError) {
    return error.status >= 500;
  }
  return error instanceof Error;
}

async function waitForRateLimit(
  error: MarkupApiError,
  attempt: number,
  options: RequestOptions,
): Promise<void> {
  const backoff = parseRetryAfter(error) ?? DEFAULT_RATE_LIMIT_BACKOFF_MS * (attempt + 1);
  core.warning(
    `Rate limited on ${options.method} ${options.path}; waiting ${Math.round(backoff).toString()}ms before retry ${(attempt + 1).toString()}/${MAX_RATE_LIMIT_RETRIES.toString()}`,
  );
  await sleep(backoff);
}

/**
 * Wraps `request` with:
 * - up to MAX_TRANSIENT_RETRIES retries on 5xx / network errors
 * - up to MAX_RATE_LIMIT_RETRIES retries on 429 (rate limit) with backoff
 *   honoring the `Retry-After` header (and `retry_after` body fields as a
 *   fallback)
 *
 * Both retries flow through the same loop so a transient → 429 (or vice
 * versa) cascade is handled correctly — a retry that itself throws is caught
 * by the next iteration's try block.
 */
async function requestWithRetry<T>(apiKey: string, options: RequestOptions): Promise<T> {
  let rateLimitAttempts = 0;
  let transientAttempts = 0;

  for (;;) {
    try {
      const result = await request<T>(apiKey, options);
      return result.body;
    } catch (error) {
      if (isRateLimit(error)) {
        if (rateLimitAttempts >= MAX_RATE_LIMIT_RETRIES) throw error;
        await waitForRateLimit(error, rateLimitAttempts, options);
        rateLimitAttempts++;
        continue;
      }
      if (isRetryableTransient(error)) {
        if (transientAttempts >= MAX_TRANSIENT_RETRIES) throw error;
        core.warning(`Retrying ${options.method} ${options.path}: ${String(error)}`);
        transientAttempts++;
        continue;
      }
      throw error;
    }
  }
}

export async function getStyleAgentConfig(apiKey: string): Promise<OrganizationConfigResponse> {
  return requestWithRetry<OrganizationConfigResponse>(apiKey, {
    method: "GET",
    path: "style-agent/config",
  });
}

export function assertStyleAgentEnabled(config: OrganizationConfigResponse): void {
  if (config.style_agent !== "enabled" && config.style_agent !== "enabled_terminology") {
    throw new Error(ERROR_MESSAGES.STYLE_AGENT_DISABLED);
  }
}

export async function listStyleGuides(apiKey: string): Promise<StyleGuide[]> {
  let styleGuides: StyleGuide[] | null;
  try {
    styleGuides = await requestWithRetry<StyleGuide[] | null>(apiKey, {
      method: "GET",
      path: "style-agent/style-guides",
    });
  } catch (error) {
    // Defensive fallback for any environment still on the deprecated route.
    // Prod has migrated to /style-guides; this only fires on a 404 from an
    // older deployment and is otherwise a no-op.
    if (error instanceof MarkupApiError && error.status === 404) {
      styleGuides = await requestWithRetry<StyleGuide[] | null>(apiKey, {
        method: "GET",
        path: "style-agent/targets",
      });
    } else {
      throw error;
    }
  }
  if (!Array.isArray(styleGuides)) {
    return [];
  }
  return styleGuides.filter((sg) => sg.enabled);
}

export async function runStyleAgent(
  apiKey: string,
  body: AgentRunRequest,
): Promise<AgentRunResponse> {
  return requestWithRetry<AgentRunResponse>(apiKey, {
    method: "POST",
    path: `agents/${STYLE_AGENT_ID}/run`,
    query: { wait: false },
    body,
  });
}

export async function getWorkflowStatus(
  apiKey: string,
  workflowId: string,
): Promise<AgentRunResponse> {
  return requestWithRetry<AgentRunResponse>(apiKey, {
    method: "GET",
    path: `agents/workflows/${encodeURIComponent(workflowId)}`,
  });
}

const TERMINAL_STATUSES: ReadonlySet<WorkflowStatus> = new Set([
  "completed",
  "failed",
  "timed_out",
  "cancelled",
]);

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

export async function pollUntilDone(
  apiKey: string,
  workflowId: string,
  { intervalMs = POLL_INTERVAL_MS, timeoutMs = POLL_TIMEOUT_MS }: PollOptions = {},
): Promise<AgentRunResponse> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const status = await getWorkflowStatus(apiKey, workflowId);
    if (TERMINAL_STATUSES.has(status.status)) {
      return status;
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new Error(`Workflow ${workflowId} polling timed out after ${timeoutMs.toString()}ms`);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, Math.min(intervalMs, remaining)));
  }
}

export function isFatalApiError(error: unknown): boolean {
  if (!(error instanceof MarkupApiError)) {
    return false;
  }
  return error.status === 401 || error.status === 403 || error.status >= 500;
}
