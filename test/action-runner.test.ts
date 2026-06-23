/**
 * Tests for action-runner orchestration: bootstrap, file discovery,
 * analysis, strict mode, error handling.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mockCore = {
  getInput: vi.fn<(name: string) => string>(),
  setOutput: vi.fn<(name: string, value: string | number | boolean) => void>(),
  setFailed: vi.fn<(message: string | Error) => void>(),
  info: vi.fn<(message: string) => void>(),
  warning: vi.fn<(message: string) => void>(),
  error: vi.fn<(message: string | Error) => void>(),
  debug: vi.fn<(message: string) => void>(),
};

vi.mock("@actions/core", () => mockCore);

vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(() => ({ rest: {} })),
  context: {
    repo: { owner: "octo", repo: "demo" },
    sha: "abc123def456",
    ref: "refs/heads/main",
    eventName: "push",
    serverUrl: "https://github.com",
    runId: 1,
    payload: {},
  },
}));

const apiServiceMocks = vi.hoisted(() => ({
  analyzeFiles: vi.fn<(...args: unknown[]) => Promise<unknown[]>>(),
}));

vi.mock("../src/services/api-service.js", () => ({
  analyzeFiles: apiServiceMocks.analyzeFiles,
}));

vi.mock("../src/services/markup-api-client.js", () => ({
  getStyleAgentConfig: vi.fn(() =>
    Promise.resolve({
      is_acrolinx_classic: false,
      style_agent: "enabled",
      style_agent_numeric_scoring: false,
    }),
  ),
  assertStyleAgentEnabled: vi.fn(),
  listStyleGuides: vi.fn(() =>
    Promise.resolve([
      { id: "sg_1", display_name: "Marketing Voice", is_default: true, enabled: true },
    ]),
  ),
  runStyleAgent: vi.fn(),
  pollUntilDone: vi.fn(),
  isFatalApiError: () => false,
  MarkupApiError: class extends Error {},
}));

vi.mock("../src/services/post-analysis-service.js", () => ({
  handlePostAnalysisActions: vi.fn(() => Promise.resolve()),
}));

const strategyMocks = vi.hoisted(() => ({
  createFileDiscoveryStrategy: vi.fn<() => MockStrategy>(),
}));

vi.mock("../src/strategies/index.js", () => ({
  createFileDiscoveryStrategy: strategyMocks.createFileDiscoveryStrategy,
}));

vi.mock("../src/utils/index.js", () => ({
  displayEventInfo: vi.fn(),
  displayFilesToAnalyze: vi.fn(),
  displayResults: vi.fn(),
  displaySectionHeader: vi.fn(),
  filterSupportedFiles: vi.fn((files: string[]) => files),
  readFileContent: vi.fn(() => Promise.resolve("Test content")),
  logError: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  readFile: vi.fn(() => Promise.resolve("Test content")),
}));

interface MockStrategy {
  getEventInfo: ReturnType<typeof vi.fn>;
  getFilesToAnalyze: ReturnType<typeof vi.fn<() => Promise<string[]>>>;
}

const { runAction } = await import("../src/action-runner.js");

function defaultInputMock(overrides: Record<string, string> = {}) {
  return (name: string) => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    switch (name) {
      case "markup_ai_api_key":
        return "key";
      case "github_token":
        return "tok";
      case "style_guide":
        return "Marketing Voice";
      case "strict_mode":
        return "true";
      default:
        return "";
    }
  };
}

function buildResults(filePaths: string[]) {
  return filePaths.map((filePath) => ({
    filePath,
    workflowId: "agw_1",
    status: "completed",
    issues: [],
    issueCounts: { total: 0, high: 0, medium: 0, low: 0 },
    scores: null,
    analysis: null,
    timestamp: "2024-01-01T00:00:00Z",
  }));
}

let mockStrategy: MockStrategy;

beforeEach(() => {
  vi.clearAllMocks();
  mockStrategy = {
    getEventInfo: vi.fn(() => ({
      eventType: "push",
      description: "push",
      filesCount: 0,
    })),
    getFilesToAnalyze: vi.fn(() => Promise.resolve([])),
  };
  strategyMocks.createFileDiscoveryStrategy.mockReturnValue(mockStrategy);
  mockCore.getInput.mockImplementation(defaultInputMock());
});

describe("runAction — strict mode", () => {
  it("passes when all files are analyzed", async () => {
    const files = ["README.md", "src/main.ts", "docs/api.md"];
    mockStrategy.getFilesToAnalyze.mockResolvedValue(files);
    apiServiceMocks.analyzeFiles.mockResolvedValue(buildResults(files));

    await runAction();
    expect(mockCore.setFailed).not.toHaveBeenCalledWith("Some files were not analyzed.");
    expect(mockCore.setOutput).toHaveBeenCalledWith("files-analyzed", String(files.length));
  });

  it("fails when some files are not analyzed", async () => {
    const files = ["a.md", "b.md", "c.md"];
    mockStrategy.getFilesToAnalyze.mockResolvedValue(files);
    apiServiceMocks.analyzeFiles.mockResolvedValue(buildResults(files.slice(0, -1)));

    await runAction();
    expect(mockCore.setFailed).toHaveBeenCalledWith("Some files were not analyzed.");
  });
});

describe("runAction — strict_mode disabled", () => {
  it("passes even when some files are not analyzed", async () => {
    mockCore.getInput.mockImplementation(defaultInputMock({ strict_mode: "false" }));
    const files = ["a.md", "b.md", "c.md"];
    mockStrategy.getFilesToAnalyze.mockResolvedValue(files);
    apiServiceMocks.analyzeFiles.mockResolvedValue(buildResults(files.slice(0, -1)));

    await runAction();
    expect(mockCore.setFailed).not.toHaveBeenCalledWith("Some files were not analyzed.");
  });
});

describe("runAction — edge cases", () => {
  it("handles zero files found", async () => {
    mockStrategy.getFilesToAnalyze.mockResolvedValue([]);
    await runAction();
    expect(mockCore.setOutput).toHaveBeenCalledWith("files-analyzed", "0");
    expect(mockCore.info).toHaveBeenCalledWith("No supported files found to analyze.");
  });

  it("fails when analysis returns no results despite files present", async () => {
    mockStrategy.getFilesToAnalyze.mockResolvedValue(["a.md"]);
    apiServiceMocks.analyzeFiles.mockResolvedValue([]);
    await runAction();
    expect(mockCore.setFailed).toHaveBeenCalledWith("Failed to analyze supported files.");
  });

  it("propagates Error instances via setFailed", async () => {
    strategyMocks.createFileDiscoveryStrategy.mockImplementation(() => {
      throw new Error("Strategy creation failed");
    });
    await runAction();
    expect(mockCore.setFailed).toHaveBeenCalledWith("Strategy creation failed");
  });

  it("fails when a required input is missing", async () => {
    mockCore.getInput.mockImplementation(defaultInputMock({ markup_ai_api_key: "" }));
    await runAction();
    expect(mockCore.setFailed).toHaveBeenCalledWith(
      expect.stringContaining("Required input 'markup_ai_api_key'"),
    );
  });

  it("paths input narrows analysis to the listed files", async () => {
    mockCore.getInput.mockImplementation(defaultInputMock({ paths: "README.md" }));
    const allDiscovered = ["README.md", "src/main.ts", "docs/api.md", "CHANGELOG.md"];
    mockStrategy.getFilesToAnalyze.mockResolvedValue(allDiscovered);
    apiServiceMocks.analyzeFiles.mockImplementation((_key, files: unknown) => {
      return Promise.resolve(buildResults(files as string[]));
    });

    await runAction();

    // Only README.md should have been passed to analyzeFiles.
    expect(apiServiceMocks.analyzeFiles).toHaveBeenCalledTimes(1);
    const filesArg = apiServiceMocks.analyzeFiles.mock.calls[0]?.[1] as string[];
    expect(filesArg).toEqual(["README.md"]);
    expect(mockCore.setOutput).toHaveBeenCalledWith("files-analyzed", "1");
  });

  it("paths input that matches nothing short-circuits with files-analyzed=0", async () => {
    mockCore.getInput.mockImplementation(defaultInputMock({ paths: "DOES_NOT_EXIST.md" }));
    mockStrategy.getFilesToAnalyze.mockResolvedValue(["README.md", "docs/api.md"]);

    await runAction();

    expect(apiServiceMocks.analyzeFiles).not.toHaveBeenCalled();
    expect(mockCore.setOutput).toHaveBeenCalledWith("files-analyzed", "0");
  });
});
