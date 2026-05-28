import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(),
  context: {
    serverUrl: "https://github.com",
    runId: 99,
    repo: { owner: "octo", repo: "demo" },
  },
}));

import {
  createGitHubClient,
  getCommitChanges,
  getPullRequestFiles,
  getRepositoryFiles,
  updateCommitStatus,
} from "../../src/services/github-service.js";
import {
  buildAnalysisOptions,
  buildAnalysisResult,
  buildScores,
  severities,
} from "../test-helpers/scores.js";

type MockFn = ReturnType<typeof vi.fn>;
function makeOctokit() {
  const paginate = vi.fn();
  return {
    paginate,
    rest: {
      repos: {
        getCommit: vi.fn(),
        createCommitStatus: vi.fn(),
      },
      pulls: { listFiles: vi.fn() },
      git: { getTree: vi.fn() },
    },
  } as unknown as {
    paginate: MockFn;
    rest: {
      repos: { getCommit: MockFn; createCommitStatus: MockFn };
      pulls: { listFiles: MockFn };
      git: { getTree: MockFn };
    };
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createGitHubClient", () => {
  it("returns a value (delegated to @actions/github)", async () => {
    const github = await import("@actions/github");
    (github.getOctokit as ReturnType<typeof vi.fn>).mockReturnValue({ rest: {} });
    expect(createGitHubClient("token")).toBeTruthy();
  });
});

describe("getCommitChanges", () => {
  it("maps a GitHub commit into CommitInfo", async () => {
    const octokit = makeOctokit();
    octokit.rest.repos.getCommit.mockResolvedValueOnce({
      data: {
        sha: "abc",
        commit: {
          message: "fix",
          author: { name: "Octo", date: "2024-01-15T10:00:00Z" },
        },
        files: [{ filename: "a.md", status: "modified", additions: 1, deletions: 2, changes: 3 }],
      },
    });
    const info = await getCommitChanges(
      octokit as unknown as Parameters<typeof getCommitChanges>[0],
      "octo",
      "demo",
      "abc",
    );
    expect(info?.sha).toBe("abc");
    expect(info?.changes[0].filename).toBe("a.md");
  });

  it("returns null when the request fails", async () => {
    const octokit = makeOctokit();
    octokit.rest.repos.getCommit.mockRejectedValue(new Error("boom"));
    const info = await getCommitChanges(
      octokit as unknown as Parameters<typeof getCommitChanges>[0],
      "octo",
      "demo",
      "abc",
    );
    expect(info).toBeNull();
  });
});

describe("getPullRequestFiles", () => {
  it("returns filenames from paginate", async () => {
    const octokit = makeOctokit();
    octokit.paginate.mockResolvedValue([{ filename: "x.md" }, { filename: "y.md" }]);
    const result = await getPullRequestFiles(
      octokit as unknown as Parameters<typeof getPullRequestFiles>[0],
      "octo",
      "demo",
      1,
    );
    expect(result).toEqual(["x.md", "y.md"]);
  });

  it("returns [] on error", async () => {
    const octokit = makeOctokit();
    octokit.paginate.mockRejectedValue(new Error("boom"));
    expect(
      await getPullRequestFiles(
        octokit as unknown as Parameters<typeof getPullRequestFiles>[0],
        "octo",
        "demo",
        1,
      ),
    ).toEqual([]);
  });
});

describe("getRepositoryFiles", () => {
  it("returns blob paths from the tree", async () => {
    const octokit = makeOctokit();
    octokit.rest.git.getTree.mockResolvedValueOnce({
      data: {
        tree: [
          { type: "blob", path: "a.md" },
          { type: "tree", path: "dir" },
          { type: "blob", path: "b.md" },
        ],
      },
    });
    expect(
      await getRepositoryFiles(
        octokit as unknown as Parameters<typeof getRepositoryFiles>[0],
        "octo",
        "demo",
      ),
    ).toEqual(["a.md", "b.md"]);
  });
});

describe("updateCommitStatus", () => {
  it("bails on invalid SHA", async () => {
    const octokit = makeOctokit();
    await updateCommitStatus(
      octokit as unknown as Parameters<typeof updateCommitStatus>[0],
      "octo",
      "demo",
      "not-a-sha",
      [buildAnalysisResult()],
      buildAnalysisOptions(),
    );
    expect(octokit.rest.repos.createCommitStatus).not.toHaveBeenCalled();
  });

  it("numeric mode includes quality score in description", async () => {
    const octokit = makeOctokit();
    octokit.rest.repos.createCommitStatus.mockResolvedValue({});
    await updateCommitStatus(
      octokit as unknown as Parameters<typeof updateCommitStatus>[0],
      "octo",
      "demo",
      "abc123def456",
      [
        buildAnalysisResult({ scores: buildScores({ score: 80 }), issues: severities("low") }),
        buildAnalysisResult({ scores: buildScores({ score: 60 }), issues: severities("high") }),
      ],
      buildAnalysisOptions({ numericScoringEnabled: true }),
    );
    const call = octokit.rest.repos.createCommitStatus.mock.calls[0]?.[0] as
      | { sha?: string; description?: string }
      | undefined;
    expect(call?.sha).toBe("abc123def456");
    expect(call?.description).toMatch(/Quality\s+70/);
  });

  it("risk mode leads with Risk label", async () => {
    const octokit = makeOctokit();
    octokit.rest.repos.createCommitStatus.mockResolvedValue({});
    await updateCommitStatus(
      octokit as unknown as Parameters<typeof updateCommitStatus>[0],
      "octo",
      "demo",
      "abc123def456",
      [buildAnalysisResult({ issues: severities("medium") })],
      buildAnalysisOptions({ numericScoringEnabled: false }),
    );
    const call = octokit.rest.repos.createCommitStatus.mock.calls[0]?.[0] as
      | { state?: string; description?: string }
      | undefined;
    expect(call?.state).toBe("failure");
    expect(call?.description).toMatch(/Risk\s+Medium/);
  });
});
