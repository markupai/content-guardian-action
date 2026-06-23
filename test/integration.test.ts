/**
 * Integration tests for the action — wires real action-runner against
 * mocked Markup AI client + GitHub API.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as core from "./mocks/core.js";
import type { AnalysisResult } from "../src/types/index.js";

vi.mock("@actions/core", () => core);

vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(() => ({
    rest: {
      repos: {
        getCommit: vi.fn(() =>
          Promise.resolve({
            data: {
              sha: "abc123def456",
              commit: {
                message: "test commit",
                author: { name: "Octo", date: "2024-01-15T10:30:00Z" },
              },
              files: [
                {
                  filename: "README.md",
                  status: "modified",
                  additions: 1,
                  deletions: 0,
                  changes: 1,
                },
                {
                  filename: "docs.txt",
                  status: "modified",
                  additions: 2,
                  deletions: 0,
                  changes: 2,
                },
              ],
            },
          }),
        ),
        createCommitStatus: vi.fn().mockResolvedValue({}),
      },
    },
  })),
  context: {
    repo: { owner: "test-owner", repo: "test-repo" },
    sha: "abc123def456",
    eventName: "push",
    ref: "refs/heads/main",
    serverUrl: "https://github.com",
    runId: 1,
    payload: {},
  },
}));

vi.mock("fs/promises", () => ({
  readFile: vi.fn(() => Promise.resolve("Test content")),
}));

// Mock the Markup AI client at the source.
const getStyleAgentConfig = vi.fn(() =>
  Promise.resolve({
    is_acrolinx_classic: false,
    style_agent: "enabled" as const,
    style_agent_numeric_scoring: true,
  }),
);
const listStyleGuides = vi.fn(() =>
  Promise.resolve([
    { id: "sg_1", display_name: "Marketing Voice", is_default: true, enabled: true },
  ]),
);
const runStyleAgent = vi.fn(() =>
  Promise.resolve({ workflow_id: "agw_1", status: "running", started_at: "2026-01-01" }),
);
const pollUntilDone = vi.fn(() =>
  Promise.resolve({
    workflow_id: "agw_1",
    status: "completed" as const,
    started_at: "2026-01-01",
    result: {
      quality: { score: 87 },
      issues: [
        {
          severity: "low" as const,
          explanation: "x",
          category: "grammar",
          position: { start: 0, end: 4, text: "Test" },
        },
      ],
    },
  }),
);
const assertStyleAgentEnabled = vi.fn();

vi.mock("../src/services/markup-api-client.js", () => ({
  getStyleAgentConfig,
  listStyleGuides,
  runStyleAgent,
  pollUntilDone,
  assertStyleAgentEnabled,
  isFatalApiError: () => false,
  MarkupApiError: class extends Error {},
}));

const { run } = await import("../src/main.js");

function mockInput(map: Record<string, string>): (name: string) => string {
  return (name: string) => map[name] ?? "";
}

function applyDefaultInputs() {
  core.getInput.mockImplementation((name: string) => {
    switch (name) {
      case "markup_ai_api_key":
        return "test-key";
      case "github_token":
        return "gh-tok";
      case "style_guide":
        return "Marketing Voice";
      default:
        return "";
    }
  });
}

describe("Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    applyDefaultInputs();
    process.env.GITHUB_TOKEN = "gh-tok";
  });

  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.MARKUP_AI_API_KEY;
    delete process.env.STYLE_GUIDE;
  });

  it("runs the full happy-path push flow", async () => {
    await run();

    expect(core.setOutput).toHaveBeenCalledWith("event-type", "push");
    expect(core.setOutput).toHaveBeenCalledWith("files-analyzed", "2");

    const resultsCall = core.setOutput.mock.calls.find(([k]) => k === "results");
    expect(resultsCall).toBeDefined();
    const results = JSON.parse((resultsCall as unknown as [string, string])[1]) as AnalysisResult[];
    expect(results).toHaveLength(2);
    expect(results[0].scores?.score).toBe(87);
  });

  it("fails when the API key input is missing", async () => {
    core.getInput.mockImplementation(
      mockInput({ markup_ai_api_key: "", style_guide: "Marketing Voice", github_token: "gh-tok" }),
    );
    await run();
    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining("Required input 'markup_ai_api_key'"),
    );
  });

  it("falls back to the org's default style guide when style_guide input is omitted", async () => {
    core.getInput.mockImplementation(
      mockInput({ markup_ai_api_key: "k", style_guide: "", github_token: "gh-tok" }),
    );
    await run();
    // Default style guide in the test fixture (`listStyleGuides` mock) is
    // sg_1 (is_default: true). The action should resolve to it and run.
    expect(runStyleAgent).toHaveBeenCalledWith(
      "k",
      expect.objectContaining({ style_guide_id: "sg_1" }),
    );
  });

  it("resolves the style guide by display name", async () => {
    await run();
    expect(runStyleAgent).toHaveBeenCalledWith(
      "test-key",
      expect.objectContaining({ style_guide_id: "sg_1" }),
    );
  });

  it("falls back to env vars when inputs are empty", async () => {
    core.getInput.mockReturnValue("");
    process.env.MARKUP_AI_API_KEY = "env-key";
    process.env.GITHUB_TOKEN = "env-gh";
    process.env.STYLE_GUIDE = "Marketing Voice";
    await run();
    expect(core.setOutput).toHaveBeenCalledWith("event-type", "push");
  });
});
