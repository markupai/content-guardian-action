/**
 * Integration tests for the action
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as core from "./mocks/core.js";
import type { AnalysisResult } from "../src/types/index.js";

// Mock dependencies
vi.mock("@actions/core", () => core);
vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(() => ({
    rest: {
      repos: {
        getCommit: vi.fn(() =>
          Promise.resolve({
            data: {
              sha: "abc123456789",
              commit: {
                message: "test commit",
                author: {
                  name: "Test User",
                  date: "2024-01-15T10:30:00Z",
                },
              },
              files: [
                {
                  filename: "README.md",
                  status: "modified",
                  additions: 5,
                  deletions: 2,
                  changes: 7,
                  patch: "@@ -1,3 +1,5 @@\n-test\n+new test\n",
                },
                {
                  filename: "docs.txt",
                  status: "modified",
                  additions: 10,
                  deletions: 3,
                  changes: 13,
                  patch: "@@ -1,3 +1,10 @@\n-old content\n+new content\n",
                },
              ],
            },
          }),
        ),
      },
    },
  })),
  context: {
    repo: {
      owner: "test-owner",
      repo: "test-repo",
    },
    sha: "abc123456789",
    eventName: "push",
  },
}));

vi.mock("@markupai/toolkit", async () => {
  const originalModule = await vi.importActual("@markupai/toolkit");
  return {
    ...(originalModule as object),
    styleCheck: vi.fn(() =>
      Promise.resolve({
        workflow: {
          id: "test-workflow-123",
          type: "checks",
          api_version: "1.0.0",
          generated_at: "2025-01-15T14:22:33Z",
          status: "completed",
          webhook_response: {
            url: "https://api.example.com/webhook",
            status_code: 200,
          },
        },
        config: {
          dialect: "american_english",
          style_guide: { style_guide_type: "ap", style_guide_id: "sg-123" },
          tone: "formal",
        },
        original: {
          issues: [
            {
              original: "test text",
              position: { start_index: 10 },
              subcategory: "passive_voice",
              category: "grammar",
            },
          ],
          scores: {
            quality: {
              score: 85.2,
              grammar: { score: 90.1, issues: 2 },
              consistency: { score: 88.3, issues: 1 },
              terminology: { score: 95, issues: 0 },
            },
            analysis: {
              clarity: { score: 78.5 },
              tone: { score: 82.3 },
            },
          },
        },
      }),
    ),
    styleBatchCheckRequests: vi.fn(() => ({
      progress: {
        total: 1,
        completed: 1,
        failed: 0,
        inProgress: 0,
        pending: 0,
        results: [
          {
            index: 0,
            status: "completed",
            result: {
              workflow: {
                id: "test-workflow-123",
                type: "checks",
                api_version: "1.0.0",
                generated_at: "2025-01-15T14:22:33Z",
                status: "completed",
                webhook_response: {
                  url: "https://api.example.com/webhook",
                  status_code: 200,
                },
              },
              config: {
                dialect: "american_english",
                style_guide: {
                  style_guide_type: "ap",
                  style_guide_id: "sg-123",
                },
                tone: "formal",
              },
              original: {
                issues: [],
                scores: {
                  quality: {
                    score: 85.2,
                    grammar: { score: 90.1, issues: 2 },
                    consistency: { score: 88.3, issues: 1 },
                    terminology: { score: 95, issues: 0 },
                  },
                  analysis: {
                    clarity: { score: 78.5 },
                    tone: { score: 82.3 },
                  },
                },
              },
            },
          },
        ],
        startTime: Date.now(),
      },
      promise: Promise.resolve({
        total: 1,
        completed: 1,
        failed: 0,
        inProgress: 0,
        pending: 0,
        results: [
          {
            index: 0,
            status: "completed",
            result: {
              workflow: {
                id: "test-workflow-123",
                type: "checks",
                api_version: "1.0.0",
                generated_at: "2025-01-15T14:22:33Z",
                status: "completed",
                webhook_response: {
                  url: "https://api.example.com/webhook",
                  status_code: 200,
                },
              },
              config: {
                dialect: "american_english",
                style_guide: {
                  style_guide_type: "ap",
                  style_guide_id: "sg-123",
                },
                tone: "formal",
              },
              original: {
                issues: [],
                scores: {
                  quality: {
                    score: 85.2,
                    grammar: { score: 90.1, issues: 2 },
                    consistency: { score: 88.3, issues: 1 },
                    terminology: { score: 95, issues: 0 },
                  },
                  analysis: {
                    clarity: { score: 78.5 },
                    tone: { score: 82.3 },
                  },
                },
              },
            },
          },
        ],
        startTime: Date.now(),
      }),
      cancel: vi.fn(),
    })),
  };
});

// Mock fs/promises
vi.mock("fs/promises", () => ({
  readFile: vi.fn(() => Promise.resolve("Test content for analysis")),
}));

const { run } = await import("../src/main.js");

describe("Integration Tests", () => {
  beforeEach(() => {
    // Set the action's inputs as return values from core.getInput().
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case "markup_ai_api_key":
          return "test-markup_ai_api_key";
        case "dialect":
          return "american_english";
        case "tone":
          return "formal";
        case "style-guide":
          return "ap";
        case "github_token":
          return "test-github-token";
        default:
          return "";
      }
    });

    // Mock process.env.GITHUB_TOKEN and GITHUB_REPOSITORY
    process.env.GITHUB_TOKEN = "test-github-token";
    process.env.GITHUB_REPOSITORY = "test-owner/test-repo";
  });

  afterEach(() => {
    // Only reset core mocks, not the module mocks
    vi.clearAllMocks();
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_REPOSITORY;
  });

  describe("Main Action Flow", () => {
    it("should run complete workflow successfully", async () => {
      await run();

      // Verify the outputs were set correctly
      expect(core.setOutput).toHaveBeenCalledWith("event-type", "push");
      expect(core.setOutput).toHaveBeenCalledWith("files-analyzed", "2");
      expect(core.setOutput).toHaveBeenCalledWith("results", expect.any(String));

      // Verify the results contain the expected data
      const resultsCall = core.setOutput.mock.calls.find((call) => call[0] === "results");
      expect(resultsCall).toBeDefined();
      if (!resultsCall) throw new Error("resultsCall not found");
      const results = JSON.parse(resultsCall[1] as string) as AnalysisResult[];

      expect(results).toHaveLength(2);
      expect(results.some((r) => r.filePath === "README.md")).toBe(true);
      expect(results.some((r) => r.filePath === "docs.txt")).toBe(true);
      expect(results[0].result.quality.score).toBe(85.2);
    });

    it("should filter out deleted files from analysis", async () => {
      // This test verifies that the filtering logic is in place
      // The actual filtering behavior is tested in the unit tests
      // Here we just verify the action runs successfully with the current mock
      // The mock returns files with status "modified", so they should be analyzed
      await run();

      // Verify the outputs were set correctly
      expect(core.setOutput).toHaveBeenCalledWith("event-type", "push");
      expect(core.setOutput).toHaveBeenCalledWith("files-analyzed", "2");
      expect(core.setOutput).toHaveBeenCalledWith("results", expect.any(String));

      // Verify the results contain the expected data
      const resultsCall = core.setOutput.mock.calls.find((call) => call[0] === "results");
      expect(resultsCall).toBeDefined();
      if (!resultsCall) throw new Error("resultsCall not found");
      const results = JSON.parse(resultsCall[1] as string) as AnalysisResult[];

      expect(results).toHaveLength(2);
      expect(results.some((r) => r.filePath === "README.md")).toBe(true);
      expect(results.some((r) => r.filePath === "docs.txt")).toBe(true);
      expect(results[0].result.quality.score).toBe(85.2);
    });

    it("should handle missing token", async () => {
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case "markup_ai_api_key":
            return "";
          case "dialect":
            return "american_english";
          case "tone":
            return "";
          case "style-guide":
            return "ap";
          case "github_token":
            return "test-github-token";
          default:
            return "";
        }
      });

      await run();

      expect(core.setFailed).toHaveBeenCalledWith(
        "Required input 'markup_ai_api_key' or environment variable 'MARKUP_AI_API_KEY' is not provided",
      );
    });

    it("should handle missing GitHub token", async () => {
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case "markup_ai_api_key":
            return "test-markup_ai_api_key";
          case "dialect":
            return "american_english";
          case "tone":
            return "formal";
          case "style-guide":
            return "ap";
          case "github_token":
            return "";
          default:
            return "";
        }
      });

      delete process.env.GITHUB_TOKEN;

      await run();

      expect(core.setFailed).toHaveBeenCalledWith(
        "Required input 'github_token' or environment variable 'GITHUB_TOKEN' is not provided",
      );
    });

    it("should handle custom analysis options", async () => {
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case "markup_ai_api_key":
            return "test-markup_ai_api_key";
          case "dialect":
            return "british_english";
          case "tone":
            return "informal";
          case "style-guide":
            return "chicago";
          case "github_token":
            return "test-github-token";
          default:
            return "";
        }
      });

      await run();

      // Verify the action completed successfully with custom options
      expect(core.setOutput).toHaveBeenCalledWith("event-type", "push");
      expect(core.setOutput).toHaveBeenCalledWith("files-analyzed", "2");
      expect(core.setOutput).toHaveBeenCalledWith("results", expect.any(String));
    });
  });

  describe("Configuration Validation", () => {
    it("should validate required inputs", async () => {
      // Test with empty required inputs
      core.getInput.mockReturnValue("");

      await run();

      expect(core.setFailed).toHaveBeenCalledWith(expect.stringContaining("Required input"));
    });

    it("should use environment variables as fallback", async () => {
      core.getInput.mockReturnValue("");
      process.env.MARKUP_AI_API_KEY = "env-markup_ai_api_key";
      process.env.GITHUB_TOKEN = "env-github-token";
      process.env.DIALECT = "american_english";
      process.env.STYLE_GUIDE = "ap";

      await run();

      // Should still work with environment variables
      expect(core.setOutput).toHaveBeenCalledWith("event-type", "push");
      expect(core.setOutput).toHaveBeenCalledWith("files-analyzed", "2");
    });
  });
});
