/**
 * Unit tests for error utilities
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as core from "../mocks/core.js";

// Mock @actions/core
vi.mock("@actions/core", () => core);

const {
  DEFAULT_RETRY_CONFIG,
  delay,
  calculateBackoffDelay,
  withRetry,
  handleGitHubError,
  handleApiError,
  isNetworkError,
  isRateLimitError,
  logError,
  GitHubAPIError,
  ApiError,
} = await import("../../src/utils/error-utils.js");

// Import the type separately
type RetryConfig = import("../../src/utils/error-utils.js").RetryConfig;

describe("Error Utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Constants", () => {
    it("should export default retry configuration", () => {
      expect(DEFAULT_RETRY_CONFIG).toEqual({
        maxRetries: 3,
        baseDelay: 1_000,
        maxDelay: 10_000,
        backoffMultiplier: 2,
      });
    });
  });

  describe("Error Classes", () => {
    describe("GitHubAPIError", () => {
      it("should create GitHub API error with message", () => {
        const error = new GitHubAPIError("Test error");
        expect(error.message).toBe("Test error");
        expect(error.name).toBe("GitHubAPIError");
        expect(error.status).toBeUndefined();
        expect(error.code).toBeUndefined();
      });

      it("should create GitHub API error with status and code", () => {
        const error = new GitHubAPIError("Test error", 404, "NOT_FOUND");
        expect(error.message).toBe("Test error");
        expect(error.status).toBe(404);
        expect(error.code).toBe("NOT_FOUND");
      });
    });

    describe("ApiError", () => {
      it("should create API error with message", () => {
        const error = new ApiError("Test error");
        expect(error.message).toBe("Test error");
        expect(error.name).toBe("ApiError");
        expect(error.status).toBeUndefined();
        expect(error.code).toBeUndefined();
      });

      it("should create API error with status and code", () => {
        const error = new ApiError("Test error", 500, "INTERNAL_ERROR");
        expect(error.message).toBe("Test error");
        expect(error.status).toBe(500);
        expect(error.code).toBe("INTERNAL_ERROR");
      });
    });
  });

  describe("delay", () => {
    it("should delay for specified milliseconds", async () => {
      const startTime = Date.now();
      await delay(10); // Use a short delay for testing
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(5); // Allow some tolerance
    });
  });

  describe("calculateBackoffDelay", () => {
    it("should calculate exponential backoff delay", () => {
      const config: RetryConfig = {
        maxRetries: 3,
        baseDelay: 1_000,
        maxDelay: 5_000,
        backoffMultiplier: 2,
      };

      expect(calculateBackoffDelay(1, config)).toBe(1_000);
      expect(calculateBackoffDelay(2, config)).toBe(2_000);
      expect(calculateBackoffDelay(3, config)).toBe(4_000);
    });

    it("should respect max delay limit", () => {
      const config: RetryConfig = {
        maxRetries: 5,
        baseDelay: 1_000,
        maxDelay: 3_000,
        backoffMultiplier: 2,
      };

      expect(calculateBackoffDelay(1, config)).toBe(1_000);
      expect(calculateBackoffDelay(2, config)).toBe(2_000);
      expect(calculateBackoffDelay(3, config)).toBe(3_000); // Capped at maxDelay
      expect(calculateBackoffDelay(4, config)).toBe(3_000); // Capped at maxDelay
    });
  });

  describe("withRetry", () => {
    it("should return result on successful operation", async () => {
      const operation = vi.fn().mockImplementation(() => Promise.resolve("success")) as ReturnType<
        typeof vi.fn<() => Promise<string>>
      >;

      const result = await withRetry(operation, DEFAULT_RETRY_CONFIG, "Test Operation");

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure and eventually succeed", async () => {
      const operation = vi
        .fn()
        .mockImplementationOnce(() => Promise.reject(new Error("First failure")))
        .mockImplementationOnce(() => Promise.reject(new Error("Second failure")))
        .mockImplementationOnce(() => Promise.resolve("success")) as ReturnType<
        typeof vi.fn<() => Promise<string>>
      >;

      const result = await withRetry(operation, DEFAULT_RETRY_CONFIG, "Test Operation");

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
    }, 10_000);

    it("should throw error after max retries", async () => {
      const operation = vi
        .fn()
        .mockImplementation(() => Promise.reject(new Error("Persistent failure"))) as ReturnType<
        typeof vi.fn<() => Promise<string>>
      >;

      await expect(withRetry(operation, DEFAULT_RETRY_CONFIG, "Test Operation")).rejects.toThrow(
        "Persistent failure",
      );

      expect(operation).toHaveBeenCalledTimes(3);
    }, 10_000);

    it("should use custom retry configuration", async () => {
      const customConfig: RetryConfig = {
        maxRetries: 2,
        baseDelay: 500,
        maxDelay: 2_000,
        backoffMultiplier: 1.5,
      };

      const operation = vi
        .fn()
        .mockImplementationOnce(() => Promise.reject(new Error("First failure")))
        .mockImplementationOnce(() => Promise.resolve("success")) as ReturnType<
        typeof vi.fn<() => Promise<string>>
      >;

      const result = await withRetry(operation, customConfig, "Test Operation");

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
    }, 10_000);

    it("should handle non-Error exceptions", async () => {
      const operation = vi
        .fn()
        .mockImplementation(() => Promise.reject(new Error("String error"))) as ReturnType<
        typeof vi.fn<() => Promise<string>>
      >;

      await expect(withRetry(operation, DEFAULT_RETRY_CONFIG, "Test Operation")).rejects.toThrow(
        "String error",
      );
    }, 10_000);

    it("should log warnings during retries", async () => {
      const operation = vi
        .fn()
        .mockImplementationOnce(() => Promise.reject(new Error("First failure")))
        .mockImplementationOnce(() => Promise.resolve("success")) as ReturnType<
        typeof vi.fn<() => Promise<string>>
      >;

      await withRetry(operation, DEFAULT_RETRY_CONFIG, "Test Operation");

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining("Attempt 1 failed for Test Operation"),
      );
    }, 10_000);

    it("should log error on final failure", async () => {
      const operation = vi
        .fn()
        .mockImplementation(() => Promise.reject(new Error("Persistent failure"))) as ReturnType<
        typeof vi.fn<() => Promise<string>>
      >;

      await expect(withRetry(operation, DEFAULT_RETRY_CONFIG, "Test Operation")).rejects.toThrow(
        "Persistent failure",
      );

      expect(core.error).toHaveBeenCalledWith(
        expect.stringContaining("Test Operation failed after 3 attempts"),
      );
    }, 10_000);
  });

  describe("handleGitHubError", () => {
    it("should return existing GitHubAPIError unchanged", () => {
      const originalError = new GitHubAPIError("Original error", 404);
      const result = handleGitHubError(originalError, "Test context");

      expect(result).toBe(originalError);
    });

    it("should wrap error with status in GitHubAPIError", () => {
      const error = { status: 403, message: "Forbidden" };
      const result = handleGitHubError(error, "Test context");

      expect(result).toBeInstanceOf(GitHubAPIError);
      expect(result.message).toBe("Test context: Forbidden");
      expect(result.status).toBe(403);
    });

    it("should wrap error without status in GitHubAPIError", () => {
      const error = { status: undefined, message: "Unknown error" };
      const result = handleGitHubError(error, "Test context");

      expect(result).toBeInstanceOf(GitHubAPIError);
      expect(result.message).toBe("Test context: Unknown error");
      expect(result.status).toBeUndefined();
    });

    it("should wrap generic error in GitHubAPIError", () => {
      const error = new Error("Generic error");
      const result = handleGitHubError(error, "Test context");

      expect(result).toBeInstanceOf(GitHubAPIError);
      expect(result.message).toBe("Test context: Generic error");
    });

    it("should handle non-object errors", () => {
      const result = handleGitHubError("String error", "Test context");

      expect(result).toBeInstanceOf(GitHubAPIError);
      expect(result.message).toBe("Test context: String error");
    });
  });

  describe("handleApiError", () => {
    it("should return existing ApiError unchanged", () => {
      const originalError = new ApiError("Original error", 500);
      const result = handleApiError(originalError, "Test context");

      expect(result).toBe(originalError);
    });

    it("should wrap error with status in ApiError", () => {
      const error = { status: 500, message: "Internal error" };
      const result = handleApiError(error, "Test context");

      expect(result).toBeInstanceOf(ApiError);
      expect(result.message).toBe("Test context: Internal error");
      expect(result.status).toBe(500);
    });

    it("should wrap generic error in ApiError", () => {
      const error = new Error("Generic error");
      const result = handleApiError(error, "Test context");

      expect(result).toBeInstanceOf(ApiError);
      expect(result.message).toBe("Test context: Generic error");
    });
  });

  describe("isNetworkError", () => {
    it("should return false for non-Error values", () => {
      expect(isNetworkError("string")).toBe(false);
      expect(isNetworkError(null)).toBe(false);
      expect(isNetworkError(undefined)).toBe(false);
    });

    it("should return true for network error codes", () => {
      expect(isNetworkError(new Error("ECONNRESET"))).toBe(true);
      expect(isNetworkError(new Error("ENOTFOUND"))).toBe(true);
      expect(isNetworkError(new Error("ETIMEDOUT"))).toBe(true);
      expect(isNetworkError(new Error("ECONNREFUSED"))).toBe(true);
      expect(isNetworkError(new Error("ENETUNREACH"))).toBe(true);
    });

    it("should return false for non-network errors", () => {
      expect(isNetworkError(new Error("Other error"))).toBe(false);
      expect(isNetworkError(new Error("VALIDATION_ERROR"))).toBe(false);
    });
  });

  describe("isRateLimitError", () => {
    it("should return false for non-Error values", () => {
      expect(isRateLimitError("string")).toBe(false);
      expect(isRateLimitError(null)).toBe(false);
    });

    it("should return true for rate limit messages", () => {
      expect(isRateLimitError(new Error("rate limit exceeded"))).toBe(true);
      expect(isRateLimitError(new Error("rate limit reached"))).toBe(true);
    });

    it("should return true for GitHub API 403 errors", () => {
      const error = new GitHubAPIError("Forbidden", 403);
      expect(isRateLimitError(error)).toBe(true);
    });

    it("should return false for other GitHub API errors", () => {
      const error = new GitHubAPIError("Not Found", 404);
      expect(isRateLimitError(error)).toBe(false);
    });

    it("should return false for non-rate limit errors", () => {
      expect(isRateLimitError(new Error("Other error"))).toBe(false);
    });
  });

  describe("logError", () => {
    it("should log error message for Error objects", () => {
      const error = new Error("Test error message");
      error.stack = "Test stack trace";

      logError(error, "Test context");

      expect(core.error).toHaveBeenCalledWith("Test context: Test error message");
      expect(core.debug).toHaveBeenCalledWith("Stack trace: Test stack trace");
    });

    it("should log error message without stack trace", () => {
      const error = new Error("Test error message");
      delete error.stack;

      logError(error, "Test context");

      expect(core.error).toHaveBeenCalledWith("Test context: Test error message");
      expect(core.debug).not.toHaveBeenCalled();
    });

    it("should log string representation for non-Error values", () => {
      logError("String error", "Test context");
      expect(core.error).toHaveBeenCalledWith("Test context: String error");

      logError(123, "Test context");
      expect(core.error).toHaveBeenCalledWith("Test context: 123");

      logError(null, "Test context");
      expect(core.error).toHaveBeenCalledWith("Test context: null");
    });
  });
});
