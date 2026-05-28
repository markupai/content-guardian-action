import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(),
  context: {
    eventName: "pull_request",
    sha: "abc123def456",
    issue: { number: 42 },
    repo: { owner: "octo", repo: "demo" },
    ref: "refs/heads/main",
    serverUrl: "https://github.com",
    runId: 1,
    payload: { pull_request: { head: { sha: "head-sha" } } },
  },
}));

import {
  createOrUpdatePRComment,
  createPRReviewComments,
  getPRNumber,
  isPullRequestEvent,
} from "../../src/services/pr-comment-service.js";
import {
  buildAnalysisIssue,
  buildAnalysisOptions,
  buildAnalysisResult,
  buildIssue,
} from "../test-helpers/scores.js";

type MockFn = ReturnType<typeof vi.fn>;
interface MockOctokit {
  paginate?: MockFn;
  rest: {
    repos: { get: MockFn };
    issues: { listComments: MockFn; createComment: MockFn; updateComment: MockFn };
    pulls: { createReview: MockFn; createReviewComment: MockFn; listReviewComments: MockFn };
  };
}

function makeOctokit(): MockOctokit {
  return {
    rest: {
      repos: { get: vi.fn().mockResolvedValue({ data: {} }) },
      issues: {
        listComments: vi.fn().mockResolvedValue({ data: [] }),
        createComment: vi.fn().mockResolvedValue({ data: {} }),
        updateComment: vi.fn().mockResolvedValue({ data: {} }),
      },
      pulls: {
        createReview: vi.fn().mockResolvedValue({ data: {} }),
        createReviewComment: vi.fn().mockResolvedValue({ data: {} }),
        listReviewComments: vi.fn().mockResolvedValue({ data: [] }),
      },
    },
  };
}

function commentData(octokit: MockOctokit, results = [buildAnalysisResult()]) {
  return {
    octokit,
    payload: {
      owner: "octo",
      repo: "demo",
      prNumber: 42,
      results,
      options: buildAnalysisOptions(),
      eventType: "pull_request",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isPullRequestEvent / getPRNumber", () => {
  it("isPullRequestEvent is true when event is pull_request", () => {
    expect(isPullRequestEvent()).toBe(true);
  });
  it("getPRNumber returns the issue number", () => {
    expect(getPRNumber()).toBe(42);
  });
});

describe("createOrUpdatePRComment", () => {
  it("creates a new comment when none exists", async () => {
    const { octokit, payload } = commentData(makeOctokit());
    await createOrUpdatePRComment(
      octokit as unknown as Parameters<typeof createOrUpdatePRComment>[0],
      payload,
    );
    expect(octokit.rest.issues.createComment).toHaveBeenCalled();
    expect(octokit.rest.issues.updateComment).not.toHaveBeenCalled();
  });

  it("updates the existing Markup AI comment when one exists", async () => {
    const octokit = makeOctokit();
    octokit.rest.issues.listComments.mockResolvedValueOnce({
      data: [{ id: 7, body: "## 🔍 Markup AI Analysis Results — old" }],
    });
    const { payload } = commentData(octokit);
    await createOrUpdatePRComment(
      octokit as unknown as Parameters<typeof createOrUpdatePRComment>[0],
      payload,
    );
    expect(octokit.rest.issues.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 7 }),
    );
    expect(octokit.rest.issues.createComment).not.toHaveBeenCalled();
  });

  it("bails out gracefully on 403 from repos.get", async () => {
    const octokit = makeOctokit();
    const err = new Error("denied") as Error & { status: number };
    err.status = 403;
    octokit.rest.repos.get.mockRejectedValueOnce(err);
    const { payload } = commentData(octokit);
    await createOrUpdatePRComment(
      octokit as unknown as Parameters<typeof createOrUpdatePRComment>[0],
      payload,
    );
    expect(octokit.rest.issues.createComment).not.toHaveBeenCalled();
  });
});

describe("createPRReviewComments", () => {
  function resultWithIssue() {
    return buildAnalysisResult({
      filePath: "README.md",
      issues: [
        buildAnalysisIssue({
          line: 3,
          column: 0,
          lineText: "This document have alot of issue.",
          issue: buildIssue({
            severity: "high",
            category: "grammar",
            guideline_name: "subject-verb agreement",
            position: { start: 14, end: 18, text: "have" },
            suggestion: "has",
          }),
        }),
      ],
    });
  }

  it("creates a review with one inline comment for the issue line", async () => {
    const octokit = makeOctokit();
    const { payload } = commentData(octokit, [resultWithIssue()]);
    await createPRReviewComments(
      octokit as unknown as Parameters<typeof createPRReviewComments>[0],
      payload,
    );
    const call = octokit.rest.pulls.createReview.mock.calls[0]?.[0] as
      | {
          commit_id?: string;
          event?: string;
          comments?: { path: string; line: number; side: string }[];
        }
      | undefined;
    expect(call?.commit_id).toBe("head-sha");
    expect(call?.event).toBe("COMMENT");
    expect(call?.comments?.[0]).toMatchObject({ path: "README.md", line: 3, side: "RIGHT" });
  });

  it("does nothing when there are no issues with line numbers", async () => {
    const octokit = makeOctokit();
    const { payload } = commentData(octokit);
    await createPRReviewComments(
      octokit as unknown as Parameters<typeof createPRReviewComments>[0],
      payload,
    );
    expect(octokit.rest.pulls.createReview).not.toHaveBeenCalled();
  });

  it("falls back to per-comment posting on 422 from createReview", async () => {
    const octokit = makeOctokit();
    const err = new Error("path outside diff") as Error & { status: number };
    err.status = 422;
    octokit.rest.pulls.createReview.mockRejectedValueOnce(err);

    const { payload } = commentData(octokit, [resultWithIssue()]);
    await createPRReviewComments(
      octokit as unknown as Parameters<typeof createPRReviewComments>[0],
      payload,
    );
    expect(octokit.rest.pulls.createReviewComment).toHaveBeenCalled();
  });
});
