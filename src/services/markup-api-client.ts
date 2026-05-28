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
  StyleTarget,
  WorkflowStatus,
} from "../types/index.js";

export class MarkupApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly requestId?: string,
    public readonly body?: unknown,
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

  if (!response.ok) {
    const { message, requestId } = extractMessage(
      parsed,
      `${options.method} ${options.path} failed with ${response.status.toString()}`,
    );
    throw new MarkupApiError(message, response.status, requestId, parsed);
  }

  const retryAfterHeader = response.headers.get("retry-after");
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;
  return {
    body: parsed as T,
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
  };
}

const DEFAULT_RATE_LIMIT_BACKOFF_MS = 6_500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(error: MarkupApiError): number | undefined {
  const body = error.body;
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    const candidate =
      typeof obj.retry_after === "number"
        ? obj.retry_after
        : typeof obj.retry_after_seconds === "number"
          ? obj.retry_after_seconds
          : undefined;
    if (candidate !== undefined && Number.isFinite(candidate)) {
      return candidate * 1000;
    }
  }
  return undefined;
}

/**
 * Wraps `request` with:
 * - one retry on 5xx / network errors
 * - up to two retries on 429 (rate limit) with exponential backoff and respect
 *   for a `retry_after`/`Retry-After` hint when the server provides one.
 */
async function requestWithRetry<T>(apiKey: string, options: RequestOptions): Promise<T> {
  let rateLimitAttempts = 0;
  const maxRateLimitAttempts = 2;

  for (;;) {
    try {
      const result = await request<T>(apiKey, options);
      return result.body;
    } catch (error) {
      if (error instanceof MarkupApiError && error.status === 429) {
        if (rateLimitAttempts >= maxRateLimitAttempts) {
          throw error;
        }
        const backoff =
          parseRetryAfter(error) ?? DEFAULT_RATE_LIMIT_BACKOFF_MS * (rateLimitAttempts + 1);
        core.warning(
          `Rate limited on ${options.method} ${options.path}; waiting ${Math.round(backoff).toString()}ms before retry ${(rateLimitAttempts + 1).toString()}/${maxRateLimitAttempts.toString()}`,
        );
        await sleep(backoff);
        rateLimitAttempts++;
        continue;
      }

      const retryable =
        (error instanceof MarkupApiError && error.status >= 500) ||
        (!(error instanceof MarkupApiError) && error instanceof Error);
      if (!retryable) {
        throw error;
      }
      core.warning(`Retrying ${options.method} ${options.path}: ${String(error)}`);
      const result = await request<T>(apiKey, options);
      return result.body;
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

export async function listStyleAgentTargets(apiKey: string): Promise<StyleTarget[]> {
  const targets = await requestWithRetry<StyleTarget[] | null>(apiKey, {
    method: "GET",
    path: "style-agent/targets",
  });
  if (!Array.isArray(targets)) {
    return [];
  }
  return targets.filter((t) => t.enabled);
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
