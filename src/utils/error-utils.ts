/**
 * Error handling and retry utilities.
 *
 * Note: Markup AI API errors are surfaced as `MarkupApiError` from
 * `services/markup-api-client.ts`. The helpers here cover GitHub-side errors
 * and generic retry/backoff.
 */

import * as core from "@actions/core";

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1_000,
  maxDelay: 10_000,
  backoffMultiplier: 2,
};

export class GitHubAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
    this.name = "GitHubAPIError";
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const value = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(value, config.maxDelay);
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  operationName = "Operation",
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === config.maxRetries) {
        core.error(
          `${operationName} failed after ${config.maxRetries.toString()} attempts: ${lastError.message}`,
        );
        throw lastError;
      }

      const backoffDelay = calculateBackoffDelay(attempt, config);
      core.warning(
        `Attempt ${attempt.toString()} failed for ${operationName}, retrying in ${backoffDelay.toString()}ms... Error: ${lastError.message}`,
      );

      await delay(backoffDelay);
    }
  }

  throw lastError ?? new Error(`${operationName} failed`);
}

export function handleGitHubError(error: unknown, context: string): GitHubAPIError {
  if (error instanceof GitHubAPIError) {
    return error;
  }
  if (error && typeof error === "object" && "status" in error) {
    const githubError = error as { status?: number; message?: string };
    return new GitHubAPIError(
      `${context}: ${githubError.message ?? "Unknown GitHub API error"}`,
      githubError.status,
    );
  }
  return new GitHubAPIError(
    `${context}: ${error instanceof Error ? error.message : String(error)}`,
  );
}

export function logError(error: unknown, context: string): void {
  if (error instanceof Error) {
    core.error(`${context}: ${error.message}`);
    if (error.stack) {
      core.debug(`Stack trace: ${error.stack}`);
    }
  } else {
    core.error(`${context}: ${String(error)}`);
  }
}
