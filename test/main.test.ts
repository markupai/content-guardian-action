/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import { jest } from "@jest/globals";
import * as core from "./mocks/core.js";

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule("@actions/core", () => core);
jest.unstable_mockModule("@actions/github", () => ({
  getOctokit: jest.fn(() => ({
    rest: {
      repos: {
        listCommits: jest.fn(() =>
          Promise.resolve({
            data: [
              {
                sha: "abc123456789",
                commit: {
                  message: "test commit",
                  author: {
                    name: "Test User",
                    date: "2024-01-15T10:30:00Z",
                  },
                },
              },
            ],
          }),
        ),
        getCommit: jest.fn(() =>
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
              ],
            },
          }),
        ),
      },
    },
  })),
  context: {
    repo: {
      owner: "pcdeshmukh",
      repo: "doc-test",
    },
    ref: "refs/heads/main",
    sha: "abc123456789",
    eventName: "push",
  },
}));

jest.unstable_mockModule("@markupai/toolkit", () => {
  const originalModule = jest.requireActual("@markupai/toolkit");
  return {
    ...(originalModule as object),
    styleCheck: jest.fn(() =>
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
              char_index: 10,
              subcategory: "passive_voice",
              category: "style_guide",
            },
          ],
          scores: {
            quality: {
              score: 85.2,
              grammar: { score: 90.1, issues: 2 },
              consistency: { score: 88.3, issues: 1 },
              style_guide: { score: 88.3, issues: 1 },
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
    styleBatchCheckRequests: jest.fn(() => ({
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
                    style_guide: { score: 88.3, issues: 1 },
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
                    style_guide: { score: 88.3, issues: 1 },
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
      cancel: jest.fn(),
    })),
    Config: jest.fn(),
  };
});

// Mock fs/promises
jest.unstable_mockModule("fs/promises", () => ({
  readFile: jest.fn(() => Promise.resolve("Test content for analysis")),
}));

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import("../src/main.js");

describe("main.ts", () => {
  beforeEach(() => {
    // Set the action's inputs as return values from core.getInput().
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case "markup_ai_api_key":
          return "test-markup_ai_api_key";
        case "dialect":
          return "american_english";
        case "tone":
          return "";
        case "style-guide":
          return "ap";
        case "github-token":
          return "test-token";
        default:
          return "";
      }
    });

    // Mock process.env.GITHUB_TOKEN and GITHUB_REPOSITORY
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_REPOSITORY = "pcdeshmukh/doc-test";
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_REPOSITORY;
  });

  it("Sets the event-type and files-analyzed outputs", async () => {
    await run();

    // Verify the new outputs were set correctly
    expect(core.setOutput).toHaveBeenCalledWith("event-type", "push");
    expect(core.setOutput).toHaveBeenCalledWith("files-analyzed", "1");
    expect(core.setOutput).toHaveBeenCalledWith("results", expect.any(String));
  });

  it("Fails when API token is missing", async () => {
    // Clear the getInput mock and return empty for markup_ai_api_key
    core.getInput.mockClear().mockImplementation((name: string) => {
      switch (name) {
        case "markup_ai_api_key":
          return "";
        case "dialect":
          return "american_english";
        case "tone":
          return "formal";
        case "style-guide":
          return "ap";
        case "github-token":
          return "test-token";
        default:
          return "";
      }
    });

    await run();

    // Verify that the action was marked as failed.
    expect(core.setFailed).toHaveBeenCalledWith(
      "Required input 'markup_ai_api_key' or environment variable 'MARKUP_AI_API_KEY' is not provided",
    );
  });
});
