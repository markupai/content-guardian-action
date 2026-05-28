import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildAnalysisOptions, buildAnalysisResult } from "../test-helpers/scores.js";

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@actions/github", () => ({
  context: {
    repo: { owner: "octo", repo: "demo" },
    sha: "abc123def456",
    ref: "refs/heads/main",
    serverUrl: "https://github.com",
    runId: 1,
  },
}));

const mockUpdateCommitStatus = vi.fn<() => Promise<void>>();
const mockCreateGitHubClient = vi.fn<() => Record<string, unknown>>();
const mockCreateOrUpdatePRComment = vi.fn<() => Promise<void>>();
const mockCreatePRReviewComments = vi.fn<() => Promise<void>>();
const mockIsPullRequestEvent = vi.fn<() => boolean>();
const mockGetPRNumber = vi.fn<() => number | null>();
const mockCreateJobSummary = vi.fn<() => Promise<void>>();

vi.mock("../../src/services/github-service.js", () => ({
  createGitHubClient: mockCreateGitHubClient,
  updateCommitStatus: mockUpdateCommitStatus,
}));

vi.mock("../../src/services/pr-comment-service.js", () => ({
  createOrUpdatePRComment: mockCreateOrUpdatePRComment,
  createPRReviewComments: mockCreatePRReviewComments,
  isPullRequestEvent: mockIsPullRequestEvent,
  getPRNumber: mockGetPRNumber,
}));

vi.mock("../../src/services/job-summary-service.js", () => ({
  createJobSummary: mockCreateJobSummary,
}));

import { EVENT_TYPES } from "../../src/constants/index.js";
const { handlePostAnalysisActions } = await import("../../src/services/post-analysis-service.js");

const mockOctokit = { rest: {} };
const config = {
  githubToken: "tok",
  addCommitStatus: true,
  addReviewComments: true,
  dryRun: false,
};
const options = buildAnalysisOptions();
const results = [buildAnalysisResult()];

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateGitHubClient.mockReturnValue(mockOctokit);
});

describe("handlePostAnalysisActions", () => {
  it("short-circuits when there are no results", async () => {
    await handlePostAnalysisActions(
      { eventType: EVENT_TYPES.PUSH, filesCount: 0, description: "" },
      [],
      config,
      options,
    );
    expect(mockCreateGitHubClient).not.toHaveBeenCalled();
  });

  it("push event updates commit status when enabled", async () => {
    await handlePostAnalysisActions(
      { eventType: EVENT_TYPES.PUSH, filesCount: 1, description: "" },
      results,
      config,
      options,
    );
    expect(mockUpdateCommitStatus).toHaveBeenCalledWith(
      mockOctokit,
      "octo",
      "demo",
      "abc123def456",
      results,
      options,
    );
  });

  it("push event skips commit status when disabled", async () => {
    await handlePostAnalysisActions(
      { eventType: EVENT_TYPES.PUSH, filesCount: 1, description: "" },
      results,
      { ...config, addCommitStatus: false },
      options,
    );
    expect(mockUpdateCommitStatus).not.toHaveBeenCalled();
  });

  it("workflow_dispatch writes a job summary", async () => {
    await handlePostAnalysisActions(
      { eventType: EVENT_TYPES.WORKFLOW_DISPATCH, filesCount: 1, description: "" },
      results,
      config,
      options,
    );
    expect(mockCreateJobSummary).toHaveBeenCalled();
  });

  it("schedule also writes a job summary", async () => {
    await handlePostAnalysisActions(
      { eventType: EVENT_TYPES.SCHEDULE, filesCount: 1, description: "" },
      results,
      config,
      options,
    );
    expect(mockCreateJobSummary).toHaveBeenCalled();
  });

  it("pull_request creates a comment, plus review comments when enabled", async () => {
    mockIsPullRequestEvent.mockReturnValue(true);
    mockGetPRNumber.mockReturnValue(42);

    await handlePostAnalysisActions(
      { eventType: EVENT_TYPES.PULL_REQUEST, filesCount: 1, description: "" },
      results,
      config,
      options,
    );
    expect(mockCreateOrUpdatePRComment).toHaveBeenCalled();
    expect(mockCreatePRReviewComments).toHaveBeenCalled();
  });

  it("pull_request skips review comments when disabled", async () => {
    mockIsPullRequestEvent.mockReturnValue(true);
    mockGetPRNumber.mockReturnValue(42);

    await handlePostAnalysisActions(
      { eventType: EVENT_TYPES.PULL_REQUEST, filesCount: 1, description: "" },
      results,
      { ...config, addReviewComments: false },
      options,
    );
    expect(mockCreateOrUpdatePRComment).toHaveBeenCalled();
    expect(mockCreatePRReviewComments).not.toHaveBeenCalled();
  });

  it("pull_request returns early when isPullRequestEvent is false", async () => {
    mockIsPullRequestEvent.mockReturnValue(false);

    await handlePostAnalysisActions(
      { eventType: EVENT_TYPES.PULL_REQUEST, filesCount: 1, description: "" },
      results,
      config,
      options,
    );
    expect(mockCreateOrUpdatePRComment).not.toHaveBeenCalled();
  });

  it("ignores unknown event types", async () => {
    await handlePostAnalysisActions(
      { eventType: "unknown", filesCount: 1, description: "" },
      results,
      config,
      options,
    );
    expect(mockUpdateCommitStatus).not.toHaveBeenCalled();
    expect(mockCreateJobSummary).not.toHaveBeenCalled();
    expect(mockCreateOrUpdatePRComment).not.toHaveBeenCalled();
  });

  describe("dryRun: true", () => {
    const dryConfig = { ...config, dryRun: true };

    it("skips commit status on push events", async () => {
      mockIsPullRequestEvent.mockReturnValue(false);
      await handlePostAnalysisActions(
        { eventType: EVENT_TYPES.PUSH, filesCount: 1, description: "" },
        results,
        dryConfig,
        options,
      );
      expect(mockCreateGitHubClient).not.toHaveBeenCalled();
      expect(mockUpdateCommitStatus).not.toHaveBeenCalled();
    });

    it("skips PR comment + inline reviews on pull_request events", async () => {
      mockIsPullRequestEvent.mockReturnValue(true);
      mockGetPRNumber.mockReturnValue(42);
      await handlePostAnalysisActions(
        { eventType: EVENT_TYPES.PULL_REQUEST, filesCount: 1, description: "" },
        results,
        dryConfig,
        options,
      );
      expect(mockCreateOrUpdatePRComment).not.toHaveBeenCalled();
      expect(mockCreatePRReviewComments).not.toHaveBeenCalled();
    });

    it("skips the job summary on workflow_dispatch/schedule events", async () => {
      await handlePostAnalysisActions(
        { eventType: EVENT_TYPES.WORKFLOW_DISPATCH, filesCount: 1, description: "" },
        results,
        dryConfig,
        options,
      );
      expect(mockCreateJobSummary).not.toHaveBeenCalled();
    });

    it("still emits a dry-run section header so the run is observable", async () => {
      const coreModule = await import("@actions/core");
      await handlePostAnalysisActions(
        { eventType: EVENT_TYPES.PULL_REQUEST, filesCount: 1, description: "" },
        results,
        dryConfig,
        options,
      );
      const messages = (coreModule.info as unknown as { mock: { calls: unknown[][] } }).mock.calls
        .map((args) => args[0] as string)
        .filter((msg): msg is string => typeof msg === "string");
      expect(messages.some((m) => m.includes("Dry Run"))).toBe(true);
      expect(messages.some((m) => m.includes("Dry-run mode"))).toBe(true);
    });
  });
});
