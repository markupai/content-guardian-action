/**
 * Smoke tests for src/main.ts → action-runner.runAction()
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as core from "./mocks/core.js";

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
              ],
            },
          }),
        ),
        createCommitStatus: vi.fn().mockResolvedValue({}),
      },
    },
  })),
  context: {
    repo: { owner: "octo", repo: "demo" },
    ref: "refs/heads/main",
    sha: "abc123def456",
    eventName: "push",
    serverUrl: "https://github.com",
    runId: 1,
    payload: {},
  },
}));

vi.mock("../src/services/markup-api-client.js", () => ({
  getStyleAgentConfig: vi.fn(() =>
    Promise.resolve({
      is_acrolinx_classic: false,
      style_agent: "enabled",
      style_agent_numeric_scoring: false,
    }),
  ),
  listStyleGuides: vi.fn(() =>
    Promise.resolve([
      { id: "sg_1", display_name: "Marketing Voice", is_default: true, enabled: true },
    ]),
  ),
  assertStyleAgentEnabled: vi.fn(),
  runStyleAgent: vi.fn(() =>
    Promise.resolve({ workflow_id: "agw_1", status: "running", started_at: "2026-01-01" }),
  ),
  pollUntilDone: vi.fn(() =>
    Promise.resolve({
      workflow_id: "agw_1",
      status: "completed",
      started_at: "2026-01-01",
      result: { issues: [] },
    }),
  ),
  isFatalApiError: () => false,
  MarkupApiError: class extends Error {},
}));

vi.mock("fs/promises", () => ({
  readFile: vi.fn(() => Promise.resolve("Test content")),
}));

const { run } = await import("../src/main.js");

beforeEach(() => {
  core.getInput.mockImplementation((name: string) => {
    switch (name) {
      case "markup_ai_api_key":
        return "test-key";
      case "github_token":
        return "gh-tok";
      case "style_guide":
        return "Marketing Voice";
      case "add_review_comments":
        return "false";
      default:
        return "";
    }
  });
  process.env.GITHUB_TOKEN = "gh-tok";
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.GITHUB_TOKEN;
});

describe("main.ts", () => {
  it("sets event-type and files-analyzed outputs", async () => {
    await run();
    expect(core.setOutput).toHaveBeenCalledWith("event-type", "push");
    expect(core.setOutput).toHaveBeenCalledWith("files-analyzed", "1");
    expect(core.setOutput).toHaveBeenCalledWith("results", expect.any(String));
  });

  it("fails when API token is missing", async () => {
    const inputs: Record<string, string> = {
      markup_ai_api_key: "",
      style_guide: "Marketing Voice",
      github_token: "gh-tok",
    };
    core.getInput.mockImplementation((name: string) => inputs[name] ?? "");
    await run();
    expect(core.setFailed).toHaveBeenCalledWith(
      "Required input 'markup_ai_api_key' or environment variable 'MARKUP_AI_API_KEY' is not provided",
    );
  });
});
