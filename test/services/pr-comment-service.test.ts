/**
 * Unit tests for PR Comment Service
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AnalysisResult } from "../../src/types/index.js";

// Type definitions for better type safety
interface MockGitHubContext {
  eventName: string;
  issue: {
    number: number;
  };
  repo: {
    owner: string;
    repo: string;
  };
}

// Proper Vitest mock types to avoid "never" type issues
type MockFunction = ReturnType<typeof vi.fn>;

interface MockOctokitInstance {
  rest: {
    repos: {
      get: MockFunction;
    };
    issues: {
      listComments: MockFunction;
      createComment: MockFunction;
      updateComment: MockFunction;
    };
    pulls: {
      createReview: MockFunction;
      createReviewComment: MockFunction;
    };
  };
}

interface GitHubError extends Error {
  status?: number;
}

// Mock @actions/core
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  debug: vi.fn(),
}));

// Mock @actions/github
vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(),
  context: {
    eventName: "pull_request",
    issue: {
      number: 123,
    },
    repo: {
      owner: "test-owner",
      repo: "test-repo",
    },
    ref: "refs/heads/main",
    serverUrl: "https://github.com",
  },
}));

// Import the mocked modules
import * as github from "@actions/github";
import {
  createOrUpdatePRComment,
  createPRReviewComments,
  isPullRequestEvent,
  getPRNumber,
  PRCommentData,
} from "../../src/services/pr-comment-service.js";
import { IssueCategory } from "@markupai/toolkit";
import { buildQuality, buildClarity, buildTone } from "../test-helpers/scores.js";

// Mock Octokit with proper typing
const mockOctokit: MockOctokitInstance = {
  rest: {
    repos: {
      get: vi.fn(),
    },
    issues: {
      listComments: vi.fn(),
      createComment: vi.fn(),
      updateComment: vi.fn(),
    },
    pulls: {
      createReview: vi.fn(),
      createReviewComment: vi.fn(),
    },
  },
};

// Test data factory functions
const createMockAnalysisResult = (overrides: Partial<AnalysisResult> = {}): AnalysisResult => ({
  filePath: "test.md",
  result: {
    quality: buildQuality(85, 1, {
      grammarScore: 90,
      grammarIssues: 2,
      styleGuideScore: 88,
      styleGuideIssues: 1,
      terminologyScore: 95,
      terminologyIssues: 0,
    }),
    analysis: {
      clarity: buildClarity(78),
      tone: buildTone(82),
    },
  },
  issues: [],
  timestamp: "2024-01-15T10:30:00Z",
  ...overrides,
});

const createCommentData = (results: AnalysisResult[]): PRCommentData => ({
  owner: "test-owner",
  repo: "test-repo",
  prNumber: 123,
  results,
  config: {
    dialect: "american_english",
    tone: "formal",
    styleGuide: "ap",
  },
  eventType: "pull_request",
});

const createGitHubError = (message: string, status?: number): GitHubError => {
  const error = new Error(message) as GitHubError;
  if (status !== undefined) {
    error.status = status;
  }
  return error;
};

// Helper functions for common test setup - using explicit typing to avoid "never" issues
const setupSuccessfulRepositoryAccess = (): void => {
  const mockFn = mockOctokit.rest.repos.get as ReturnType<
    typeof vi.fn<() => Promise<{ data: Record<string, unknown> }>>
  >;
  mockFn.mockResolvedValue({ data: {} });
};

const setupNoExistingComments = (): void => {
  const mockFn = mockOctokit.rest.issues.listComments as ReturnType<
    typeof vi.fn<() => Promise<{ data: Array<Record<string, unknown>> }>>
  >;
  mockFn.mockResolvedValue({ data: [] });
};

const setupExistingComment = (commentId: number): void => {
  const mockFn = mockOctokit.rest.issues.listComments as ReturnType<
    typeof vi.fn<() => Promise<{ data: Array<{ id: number; body: string }> }>>
  >;
  mockFn.mockResolvedValue({
    data: [
      {
        id: commentId,
        body: "## 🔍 Markup AI Analysis Results\nSome old content",
      },
    ],
  });
};

const setupSuccessfulCommentCreation = (commentId: number): void => {
  const mockFn = mockOctokit.rest.issues.createComment as ReturnType<
    typeof vi.fn<() => Promise<{ data: { id: number } }>>
  >;
  mockFn.mockResolvedValue({
    data: { id: commentId },
  });
};

const setupSuccessfulCommentUpdate = (commentId: number): void => {
  const mockFn = mockOctokit.rest.issues.updateComment as ReturnType<
    typeof vi.fn<() => Promise<{ data: { id: number } }>>
  >;
  mockFn.mockResolvedValue({
    data: { id: commentId },
  });
};

describe("PR Comment Service", () => {
  beforeEach(() => {
    // Clear mock call history without clearing implementations
    mockOctokit.rest.repos.get.mockClear();
    mockOctokit.rest.issues.listComments.mockClear();
    mockOctokit.rest.issues.createComment.mockClear();
    mockOctokit.rest.issues.updateComment.mockClear();
    mockOctokit.rest.pulls.createReview.mockClear();
    mockOctokit.rest.pulls.createReviewComment.mockClear();
    vi.mocked(github.getOctokit).mockReturnValue(
      mockOctokit as unknown as ReturnType<typeof github.getOctokit>,
    );
  });

  describe("isPullRequestEvent", () => {
    it("should return true for pull_request event", () => {
      (github.context as MockGitHubContext).eventName = "pull_request";
      expect(isPullRequestEvent()).toBe(true);
    });

    it("should return false for push event", () => {
      (github.context as MockGitHubContext).eventName = "push";
      expect(isPullRequestEvent()).toBe(false);
    });
  });

  describe("getPRNumber", () => {
    it("should return null for non-pull_request event", () => {
      (github.context as MockGitHubContext).eventName = "push";
      expect(getPRNumber()).toBe(null);
    });
  });

  describe("createOrUpdatePRComment", () => {
    const mockResults = [createMockAnalysisResult()];
    const commentData = createCommentData(mockResults);

    describe("successful scenarios", () => {
      it("should create new comment when no existing comment found", async () => {
        setupSuccessfulRepositoryAccess();
        setupNoExistingComments();
        setupSuccessfulCommentCreation(456);

        await createOrUpdatePRComment(
          mockOctokit as unknown as ReturnType<typeof github.getOctokit>,
          commentData,
        );

        expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          issue_number: 123,
          body: expect.stringContaining("## 🔍 Markup AI Analysis Results") as unknown,
        });
      });

      it("should update existing comment when found", async () => {
        setupSuccessfulRepositoryAccess();
        setupExistingComment(789);
        setupSuccessfulCommentUpdate(789);

        await createOrUpdatePRComment(
          mockOctokit as unknown as ReturnType<typeof github.getOctokit>,
          commentData,
        );

        expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          comment_id: 789,
          body: expect.stringContaining("## 🔍 Markup AI Analysis Results") as unknown,
        });
      });
    });

    describe("error handling", () => {
      it("should handle permission denied error for repository access", async () => {
        const permissionError = createGitHubError("Permission denied", 403);
        const mockFn = mockOctokit.rest.repos.get as ReturnType<
          typeof vi.fn<() => Promise<unknown>>
        >;
        mockFn.mockRejectedValue(permissionError);

        await createOrUpdatePRComment(
          mockOctokit as unknown as ReturnType<typeof github.getOctokit>,
          commentData,
        );

        expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
        expect(mockOctokit.rest.issues.updateComment).not.toHaveBeenCalled();
      });

      it("should handle permission denied error for comment creation", async () => {
        setupSuccessfulRepositoryAccess();
        setupNoExistingComments();

        const permissionError = createGitHubError("Permission denied", 403);
        const mockFn = mockOctokit.rest.issues.createComment as ReturnType<
          typeof vi.fn<() => Promise<unknown>>
        >;
        mockFn.mockRejectedValue(permissionError);

        await createOrUpdatePRComment(
          mockOctokit as unknown as ReturnType<typeof github.getOctokit>,
          commentData,
        );

        expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
      });

      it("should handle pull request not found error", async () => {
        setupSuccessfulRepositoryAccess();
        setupNoExistingComments();

        const notFoundError = createGitHubError("Not found", 404);
        const mockFn = mockOctokit.rest.issues.createComment as ReturnType<
          typeof vi.fn<() => Promise<unknown>>
        >;
        mockFn.mockRejectedValue(notFoundError);

        await createOrUpdatePRComment(
          mockOctokit as unknown as ReturnType<typeof github.getOctokit>,
          commentData,
        );

        expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
      });

      it("should handle generic error", async () => {
        setupSuccessfulRepositoryAccess();
        setupNoExistingComments();

        const genericError = createGitHubError("Something went wrong", 500);
        const mockFn = mockOctokit.rest.issues.createComment as ReturnType<
          typeof vi.fn<() => Promise<unknown>>
        >;
        mockFn.mockRejectedValue(genericError);

        await createOrUpdatePRComment(
          mockOctokit as unknown as ReturnType<typeof github.getOctokit>,
          commentData,
        );

        expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
      });

      it("should handle error when finding existing comments", async () => {
        setupSuccessfulRepositoryAccess();
        const mockFn = mockOctokit.rest.issues.listComments as ReturnType<
          typeof vi.fn<() => Promise<unknown>>
        >;
        mockFn.mockRejectedValue(new Error("Failed to list comments"));
        setupSuccessfulCommentCreation(456);

        await createOrUpdatePRComment(
          mockOctokit as unknown as ReturnType<typeof github.getOctokit>,
          commentData,
        );

        expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
      });
    });
  });

  describe("Comment content generation", () => {
    it("should generate proper markdown table with emojis", async () => {
      const mockResults = [createMockAnalysisResult()];
      const commentData = createCommentData(mockResults);

      setupSuccessfulRepositoryAccess();
      setupNoExistingComments();
      setupSuccessfulCommentCreation(456);

      await createOrUpdatePRComment(
        mockOctokit as unknown as ReturnType<typeof github.getOctokit>,
        commentData,
      );

      const createCall = mockOctokit.rest.issues.createComment.mock.calls[0][0] as { body: string };
      const commentBody = createCall.body;

      // Test header and structure
      expect(commentBody).toContain("## 🔍 Markup AI Analysis Results");
      expect(commentBody).toContain("## 📊 Summary");
      expect(commentBody).toContain("Quality Score Legend: 🟢 80+ | 🟡 60-79 | 🔴 0-59");

      // Test table structure
      expect(commentBody).toContain(
        "| File | Quality | Grammar | Consistency | Terminology | Clarity | Tone |",
      );

      // Test emoji display
      expect(commentBody).toContain("🟢 85"); // Green emoji for score 85

      // Test integer rounding in summary
      expect(commentBody).toContain("| Quality | 85 |");
      expect(commentBody).toContain("| Clarity | 78 |");
      expect(commentBody).toContain("| Grammar | 90 |");
      expect(commentBody).toContain("| Consistency | 88 |");
      expect(commentBody).toContain("| Tone | 82 |");
      expect(commentBody).toContain("| Terminology | 95 |");

      // Test configuration display
      expect(commentBody).toContain(
        "Configuration: Dialect: american_english | Tone: formal | Style Guide: ap",
      );
    });

    it("should handle empty results", async () => {
      const commentData = createCommentData([]);

      setupSuccessfulRepositoryAccess();
      setupNoExistingComments();
      setupSuccessfulCommentCreation(456);

      await createOrUpdatePRComment(
        mockOctokit as unknown as ReturnType<typeof github.getOctokit>,
        commentData,
      );

      const createCall = mockOctokit.rest.issues.createComment.mock.calls[0][0] as { body: string };
      expect(createCall.body).toContain("No files were analyzed.");
    });

    it("should handle multiple files with different scores", async () => {
      const mockResults = [
        createMockAnalysisResult({
          filePath: "file1.md",
          result: {
            quality: {
              score: 95,
              grammar: { score: 90, issues: 2 },
              consistency: { score: 88, issues: 1 },
              terminology: { score: 95, issues: 0 },
            },
            analysis: {
              clarity: {
                score: 78,
                word_count: 100,
                sentence_count: 5,
                average_sentence_length: 20,
                flesch_reading_ease: 75,
                vocabulary_complexity: 0.3,
                sentence_complexity: 0.4,
              },
              tone: {
                score: 82,
                informality: 0.2,
                liveliness: 0.6,
                informality_alignment: 0.8,
                liveliness_alignment: 0.7,
              },
            },
          },
        }),
        createMockAnalysisResult({
          filePath: "file2.md",
          result: {
            quality: {
              score: 65,
              grammar: { score: 90, issues: 2 },
              consistency: { score: 88, issues: 1 },
              terminology: { score: 95, issues: 0 },
            },
            analysis: {
              clarity: {
                score: 78,
                word_count: 100,
                sentence_count: 5,
                average_sentence_length: 20,
                flesch_reading_ease: 75,
                vocabulary_complexity: 0.3,
                sentence_complexity: 0.4,
              },
              tone: {
                score: 82,
                informality: 0.2,
                liveliness: 0.6,
                informality_alignment: 0.8,
                liveliness_alignment: 0.7,
              },
            },
          },
        }),
        createMockAnalysisResult({
          filePath: "file3.md",
          result: {
            quality: {
              score: 45,
              grammar: { score: 90, issues: 2 },
              consistency: { score: 88, issues: 1 },
              terminology: { score: 95, issues: 0 },
            },
            analysis: {
              clarity: {
                score: 78,
                word_count: 100,
                sentence_count: 5,
                average_sentence_length: 20,
                flesch_reading_ease: 75,
                vocabulary_complexity: 0.3,
                sentence_complexity: 0.4,
              },
              tone: {
                score: 82,
                informality: 0.2,
                liveliness: 0.6,
                informality_alignment: 0.8,
                liveliness_alignment: 0.7,
              },
            },
          },
        }),
      ];
      const commentData = createCommentData(mockResults);

      setupSuccessfulRepositoryAccess();
      setupNoExistingComments();
      setupSuccessfulCommentCreation(456);

      await createOrUpdatePRComment(
        mockOctokit as unknown as ReturnType<typeof github.getOctokit>,
        commentData,
      );

      const createCall = mockOctokit.rest.issues.createComment.mock.calls[0][0] as { body: string };
      const commentBody = createCall.body;

      // Test different emoji colors for different scores
      expect(commentBody).toContain("🟢 95"); // Green for high score
      expect(commentBody).toContain("🟡 65"); // Yellow for medium score
      expect(commentBody).toContain("🔴 45"); // Red for low score

      // Test average calculation (95 + 65 + 45) / 3 = 68.33... rounded to 68
      expect(commentBody).toContain("🟡 68"); // Yellow for average score
    });
  });

  describe("createPRReviewComments", () => {
    it("should create review comments for issues", async () => {
      setupSuccessfulRepositoryAccess();
      setupNoExistingComments();

      const issueResult: AnalysisResult = createMockAnalysisResult({
        issues: [
          {
            line: 1,
            issue: {
              original: "Teh",
              position: { start_index: 0 },
              subcategory: "spelling",
              category: IssueCategory.Grammar,
            },
          },
        ],
      });

      (github.context as { payload?: Record<string, unknown> }).payload = {
        pull_request: {
          head: { sha: "test-sha" },
        },
      };

      await createPRReviewComments(
        mockOctokit as unknown as ReturnType<typeof github.getOctokit>,
        createCommentData([issueResult]),
      );

      expect(mockOctokit.rest.pulls.createReview).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        pull_number: 123,
        commit_id: "test-sha",
        event: "COMMENT",
        comments: [
          expect.objectContaining({
            path: "test.md",
            line: 1,
            side: "RIGHT",
          }) as unknown,
        ],
      });
    });

    it("should skip review creation when no issues exist", async () => {
      (github.context as { payload?: Record<string, unknown> }).payload = {
        pull_request: {
          head: { sha: "test-sha" },
        },
      };

      await createPRReviewComments(
        mockOctokit as unknown as ReturnType<typeof github.getOctokit>,
        createCommentData([createMockAnalysisResult()]),
      );

      expect(mockOctokit.rest.pulls.createReview).not.toHaveBeenCalled();
    });
  });
});
