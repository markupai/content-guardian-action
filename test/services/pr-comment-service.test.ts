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
  reconcileReviewComments,
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
    pulls: {
      createReview: MockFn;
      createReviewComment: MockFn;
      listReviewComments: MockFn;
      updateReviewComment: MockFn;
      deleteReviewComment: MockFn;
    };
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
        updateReviewComment: vi.fn().mockResolvedValue({ data: {} }),
        deleteReviewComment: vi.fn().mockResolvedValue({ data: {} }),
      },
    },
  };
}

const SUMMARY_MARKER = "<!-- markup-ai-action:summary -->";
const REVIEW_MARKER = "<!-- markup-ai-action:review -->";

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
    const body = (
      octokit.rest.issues.createComment.mock.calls[0]?.[0] as { body?: string } | undefined
    )?.body;
    expect(body).toContain(SUMMARY_MARKER);
    expect(octokit.rest.issues.updateComment).not.toHaveBeenCalled();
  });

  it("updates the existing marker-tagged comment when one exists", async () => {
    const octokit = makeOctokit();
    octokit.rest.issues.listComments.mockResolvedValueOnce({
      data: [{ id: 7, body: `${SUMMARY_MARKER}\n## Old contents` }],
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

  it("migrates a legacy (pre-marker) comment in place", async () => {
    const octokit = makeOctokit();
    octokit.rest.issues.listComments.mockResolvedValueOnce({
      data: [{ id: 11, body: "## 🔍 Markup AI Analysis Results — old contents (no marker)" }],
    });
    const { payload } = commentData(octokit);
    await createOrUpdatePRComment(
      octokit as unknown as Parameters<typeof createOrUpdatePRComment>[0],
      payload,
    );
    expect(octokit.rest.issues.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 11 }),
    );
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

describe("reconcileReviewComments (pure)", () => {
  it("creates all when nothing exists", () => {
    const desired = [
      { path: "a.md", line: 1, side: "RIGHT" as const, body: `${REVIEW_MARKER}\nx` },
    ];
    const { toCreate, toUpdate, toDelete } = reconcileReviewComments([], desired);
    expect(toCreate).toEqual(desired);
    expect(toUpdate).toEqual([]);
    expect(toDelete).toEqual([]);
  });

  it("deletes all when nothing desired", () => {
    const existing = [{ id: 1, path: "a.md", line: 5, body: `${REVIEW_MARKER}\nold` }];
    const { toCreate, toUpdate, toDelete } = reconcileReviewComments(existing, []);
    expect(toDelete).toEqual([1]);
    expect(toCreate).toEqual([]);
    expect(toUpdate).toEqual([]);
  });

  it("no-ops on identical bodies at same line", () => {
    const body = `${REVIEW_MARKER}\nsame`;
    const existing = [{ id: 1, path: "a.md", line: 5, body }];
    const desired = [{ path: "a.md", line: 5, side: "RIGHT" as const, body }];
    const result = reconcileReviewComments(existing, desired);
    expect(result).toEqual({ toCreate: [], toUpdate: [], toDelete: [] });
  });

  it("updates when body diverges at same line", () => {
    const existing = [{ id: 9, path: "a.md", line: 5, body: `${REVIEW_MARKER}\nold` }];
    const desired = [
      { path: "a.md", line: 5, side: "RIGHT" as const, body: `${REVIEW_MARKER}\nnew` },
    ];
    const { toCreate, toUpdate, toDelete } = reconcileReviewComments(existing, desired);
    expect(toCreate).toEqual([]);
    expect(toUpdate).toEqual([{ id: 9, body: `${REVIEW_MARKER}\nnew` }]);
    expect(toDelete).toEqual([]);
  });

  it("mixes create + update + delete", () => {
    const existing = [
      { id: 1, path: "a.md", line: 1, body: `${REVIEW_MARKER}\nkeep-as-is` },
      { id: 2, path: "a.md", line: 2, body: `${REVIEW_MARKER}\nupdate-me` },
      { id: 3, path: "a.md", line: 3, body: `${REVIEW_MARKER}\ndelete-me` },
    ];
    const desired = [
      { path: "a.md", line: 1, side: "RIGHT" as const, body: `${REVIEW_MARKER}\nkeep-as-is` },
      { path: "a.md", line: 2, side: "RIGHT" as const, body: `${REVIEW_MARKER}\nupdated` },
      { path: "a.md", line: 4, side: "RIGHT" as const, body: `${REVIEW_MARKER}\nbrand-new` },
    ];
    const { toCreate, toUpdate, toDelete } = reconcileReviewComments(existing, desired);
    expect(toCreate).toEqual([
      { path: "a.md", line: 4, side: "RIGHT", body: `${REVIEW_MARKER}\nbrand-new` },
    ]);
    expect(toUpdate).toEqual([{ id: 2, body: `${REVIEW_MARKER}\nupdated` }]);
    expect(toDelete).toEqual([3]);
  });
});

describe("createPRReviewComments — integration", () => {
  it("creates a review with one inline comment when nothing exists yet", async () => {
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
          comments?: { path: string; line: number; side: string; body: string }[];
        }
      | undefined;
    expect(call?.commit_id).toBe("head-sha");
    expect(call?.event).toBe("COMMENT");
    expect(call?.comments?.[0]).toMatchObject({ path: "README.md", line: 3, side: "RIGHT" });
    expect(call?.comments?.[0].body).toContain(REVIEW_MARKER);
    expect(octokit.rest.pulls.updateReviewComment).not.toHaveBeenCalled();
    expect(octokit.rest.pulls.deleteReviewComment).not.toHaveBeenCalled();
  });

  it("deletes stale tagged comments when the underlying issue is gone", async () => {
    const octokit = makeOctokit();
    octokit.rest.pulls.listReviewComments.mockResolvedValueOnce({
      data: [
        {
          id: 99,
          path: "README.md",
          line: 3,
          body: `${REVIEW_MARKER}\n**Markup AI** detected issues:\n- old`,
        },
      ],
    });
    const { payload } = commentData(octokit, [buildAnalysisResult({ filePath: "README.md" })]);
    await createPRReviewComments(
      octokit as unknown as Parameters<typeof createPRReviewComments>[0],
      payload,
    );
    expect(octokit.rest.pulls.deleteReviewComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 99 }),
    );
    expect(octokit.rest.pulls.createReview).not.toHaveBeenCalled();
    expect(octokit.rest.pulls.updateReviewComment).not.toHaveBeenCalled();
  });

  it("updates a tagged comment in place when only the body changed", async () => {
    const octokit = makeOctokit();
    octokit.rest.pulls.listReviewComments.mockResolvedValueOnce({
      data: [{ id: 42, path: "README.md", line: 3, body: `${REVIEW_MARKER}\nstale body` }],
    });
    const { payload } = commentData(octokit, [resultWithIssue()]);
    await createPRReviewComments(
      octokit as unknown as Parameters<typeof createPRReviewComments>[0],
      payload,
    );
    expect(octokit.rest.pulls.updateReviewComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 42 }),
    );
    expect(octokit.rest.pulls.createReview).not.toHaveBeenCalled();
    expect(octokit.rest.pulls.deleteReviewComment).not.toHaveBeenCalled();
  });

  it("ignores existing review comments without our marker (treats them as foreign)", async () => {
    const octokit = makeOctokit();
    octokit.rest.pulls.listReviewComments.mockResolvedValueOnce({
      data: [
        // Different tool's review comment — must not be touched.
        { id: 500, path: "README.md", line: 3, body: "Some other reviewer's comment" },
      ],
    });
    const { payload } = commentData(octokit, [resultWithIssue()]);
    await createPRReviewComments(
      octokit as unknown as Parameters<typeof createPRReviewComments>[0],
      payload,
    );
    expect(octokit.rest.pulls.deleteReviewComment).not.toHaveBeenCalled();
    // We do create our own at the same line — they live independently.
    expect(octokit.rest.pulls.createReview).toHaveBeenCalled();
  });

  it("is a no-op when current state already matches existing tagged comments", async () => {
    const octokit = makeOctokit();
    // Run once to capture the body the action would post.
    const { payload } = commentData(octokit, [resultWithIssue()]);
    await createPRReviewComments(
      octokit as unknown as Parameters<typeof createPRReviewComments>[0],
      payload,
    );
    const captured = (
      octokit.rest.pulls.createReview.mock.calls[0]?.[0] as
        | { comments?: { path: string; line: number; body: string }[] }
        | undefined
    )?.comments?.[0];
    if (!captured) throw new Error("expected at least one captured comment");

    // Reset and feed that exact body back in as existing state.
    octokit.rest.pulls.createReview.mockClear();
    octokit.rest.pulls.updateReviewComment.mockClear();
    octokit.rest.pulls.deleteReviewComment.mockClear();
    octokit.rest.pulls.listReviewComments.mockResolvedValueOnce({
      data: [{ id: 1, path: captured.path, line: captured.line, body: captured.body }],
    });

    await createPRReviewComments(
      octokit as unknown as Parameters<typeof createPRReviewComments>[0],
      payload,
    );

    expect(octokit.rest.pulls.createReview).not.toHaveBeenCalled();
    expect(octokit.rest.pulls.updateReviewComment).not.toHaveBeenCalled();
    expect(octokit.rest.pulls.deleteReviewComment).not.toHaveBeenCalled();
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
