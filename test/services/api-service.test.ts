import { describe, it, expect, beforeEach, vi } from "vitest";

const { MarkupApiErrorRef, mocks } = vi.hoisted(() => {
  class MarkupApiErrorRef extends Error {
    public status: number;
    constructor(msg: string, status: number) {
      super(msg);
      this.name = "MarkupApiError";
      this.status = status;
    }
  }
  return {
    MarkupApiErrorRef,
    mocks: {
      runStyleAgent: vi.fn(),
      pollUntilDone: vi.fn(),
      isFatalApiError: vi.fn<(e: unknown) => boolean>(),
    },
  };
});

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("../../src/services/markup-api-client.js", () => ({
  runStyleAgent: mocks.runStyleAgent,
  pollUntilDone: mocks.pollUntilDone,
  isFatalApiError: mocks.isFatalApiError,
  MarkupApiError: MarkupApiErrorRef,
}));

import { analyzeFile, analyzeFiles } from "../../src/services/api-service.js";
import { buildAnalysisOptions } from "../test-helpers/scores.js";

const options = buildAnalysisOptions();

function completedResponse(issues: unknown[] = []) {
  return {
    workflow_id: "agw_1",
    status: "completed",
    started_at: "2026-01-01T00:00:00Z",
    result: { issues },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.runStyleAgent.mockResolvedValue({
    workflow_id: "agw_1",
    status: "running",
    started_at: "2026-01-01T00:00:00Z",
  });
  mocks.isFatalApiError.mockImplementation(
    (e: unknown) => e instanceof MarkupApiErrorRef && e.status >= 500,
  );
});

describe("analyzeFile", () => {
  it("returns AnalysisResult on a completed workflow", async () => {
    mocks.pollUntilDone.mockResolvedValue(
      completedResponse([
        {
          severity: "high",
          explanation: "x",
          category: "grammar",
          position: { start: 0, end: 4, text: "Test" },
        },
      ]),
    );

    const result = await analyzeFile("key", "README.md", "Test content", options);
    expect(result).not.toBeNull();
    expect(result?.filePath).toBe("README.md");
    expect(result?.workflowId).toBe("agw_1");
    expect(result?.status).toBe("completed");
    expect(result?.issueCounts).toEqual({ total: 1, high: 1, medium: 0, low: 0 });
    expect(mocks.runStyleAgent).toHaveBeenCalledWith("key", {
      text: "Test content",
      document_name: "README.md",
      document_ref: "README.md",
      target_id: options.targetId,
    });
  });

  it("returns null when the workflow ends in a non-completed terminal state", async () => {
    mocks.pollUntilDone.mockResolvedValue({
      workflow_id: "agw_1",
      status: "failed",
      started_at: "2026-01-01T00:00:00Z",
    });
    const result = await analyzeFile("key", "README.md", "x", options);
    expect(result).toBeNull();
  });

  it("returns null on non-fatal errors", async () => {
    mocks.runStyleAgent.mockRejectedValueOnce(new Error("transient"));
    const result = await analyzeFile("key", "README.md", "x", options);
    expect(result).toBeNull();
  });

  it("rethrows fatal API errors so the run can abort", async () => {
    mocks.runStyleAgent.mockRejectedValueOnce(new MarkupApiErrorRef("auth", 401));
    mocks.isFatalApiError.mockReturnValueOnce(true);
    await expect(analyzeFile("key", "README.md", "x", options)).rejects.toThrow("auth");
  });
});

describe("analyzeFiles", () => {
  beforeEach(() => {
    mocks.pollUntilDone.mockResolvedValue(completedResponse());
  });

  it("returns one AnalysisResult per readable file", async () => {
    const readFileContent = vi.fn((p: string) => Promise.resolve<string | null>(`content of ${p}`));
    const files = ["a.md", "b.md", "c.md"];
    const results = await analyzeFiles("k", files, options, readFileContent);
    expect(results.map((r) => r.filePath).sort()).toEqual(files);
    expect(mocks.runStyleAgent).toHaveBeenCalledTimes(3);
  });

  it("skips files whose content cannot be read", async () => {
    const readFileContent = vi.fn((p: string) =>
      Promise.resolve<string | null>(p === "b.md" ? null : "ok"),
    );
    const results = await analyzeFiles("k", ["a.md", "b.md"], options, readFileContent);
    expect(results.map((r) => r.filePath)).toEqual(["a.md"]);
  });

  it("returns [] on empty file list without calling the API", async () => {
    const results = await analyzeFiles("k", [], options, vi.fn());
    expect(results).toEqual([]);
    expect(mocks.runStyleAgent).not.toHaveBeenCalled();
  });
});
