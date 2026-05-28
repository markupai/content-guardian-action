import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

import {
  calculateBackoffDelay,
  delay,
  DEFAULT_RETRY_CONFIG,
  GitHubAPIError,
  handleGitHubError,
  logError,
  withRetry,
} from "../../src/utils/error-utils.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("delay", () => {
  it("resolves after the requested time", async () => {
    const start = Date.now();
    await delay(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });
});

describe("calculateBackoffDelay", () => {
  it("applies exponential backoff", () => {
    expect(calculateBackoffDelay(1, DEFAULT_RETRY_CONFIG)).toBe(1000);
    expect(calculateBackoffDelay(2, DEFAULT_RETRY_CONFIG)).toBe(2000);
    expect(calculateBackoffDelay(3, DEFAULT_RETRY_CONFIG)).toBe(4000);
  });

  it("caps at maxDelay", () => {
    expect(calculateBackoffDelay(10, DEFAULT_RETRY_CONFIG)).toBe(DEFAULT_RETRY_CONFIG.maxDelay);
  });
});

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const op = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(op, { ...DEFAULT_RETRY_CONFIG, baseDelay: 1, maxDelay: 1 });
    expect(result).toBe("ok");
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("retries until success", async () => {
    const op = vi.fn().mockRejectedValueOnce(new Error("nope")).mockResolvedValue("ok");
    const result = await withRetry(op, { ...DEFAULT_RETRY_CONFIG, baseDelay: 1, maxDelay: 1 });
    expect(result).toBe("ok");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries", async () => {
    const op = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(
      withRetry(op, { ...DEFAULT_RETRY_CONFIG, maxRetries: 2, baseDelay: 1, maxDelay: 1 }),
    ).rejects.toThrow("boom");
    expect(op).toHaveBeenCalledTimes(2);
  });
});

describe("handleGitHubError", () => {
  it("returns the same error if already a GitHubAPIError", () => {
    const err = new GitHubAPIError("x", 404);
    expect(handleGitHubError(err, "ctx")).toBe(err);
  });

  it("wraps an object with status and message", () => {
    const wrapped = handleGitHubError({ status: 403, message: "denied" }, "ctx");
    expect(wrapped).toBeInstanceOf(GitHubAPIError);
    expect(wrapped.status).toBe(403);
    expect(wrapped.message).toMatch(/denied/);
  });

  it("wraps a plain Error", () => {
    const wrapped = handleGitHubError(new Error("nope"), "ctx");
    expect(wrapped.message).toMatch(/nope/);
  });
});

describe("logError", () => {
  it("does not throw on Error instance", () => {
    expect(() => {
      logError(new Error("x"), "ctx");
    }).not.toThrow();
  });
  it("does not throw on string", () => {
    expect(() => {
      logError("x", "ctx");
    }).not.toThrow();
  });
});
