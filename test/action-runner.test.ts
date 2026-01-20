/**
 * Tests for strict mode functionality in action runner
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Create comprehensive mock for @actions/core
const mockCore = {
  getInput: vi.fn<(name: string) => string>(),
  setOutput: vi.fn<(name: string, value: string | number | boolean) => void>(),
  setFailed: vi.fn<(message: string | Error) => void>(),
  info: vi.fn<(message: string) => void>(),
  warning: vi.fn<(message: string) => void>(),
  error: vi.fn<(message: string | Error) => void>(),
  debug: vi.fn<(message: string) => void>(),
};

const createInputMock = (strictMode: string = "true") => {
  return (name: string) => {
    switch (name) {
      case "strict_mode":
        return strictMode;
      case "markup_ai_api_key":
        return "test-markup_ai_api_key";
      case "dialect":
        return "american_english";
      case "tone":
        return "formal";
      case "style-guide":
        return "ap";
      case "github_token":
        return "test-github-token";
      default:
        return "";
    }
  };
};

const createInputMockWithOverrides = (overrides: Record<string, string>) => {
  return (name: string) => {
    if (Object.hasOwn(overrides, name)) {
      return overrides[name];
    }
    return createInputMock()(name);
  };
};

const createFileAnalysisResults = (filePaths: string[], includeAll: boolean = true) => {
  const filesToReturn = includeAll ? filePaths : filePaths.slice(0, -1);

  return filesToReturn.map((filePath) => ({
    filePath,
    result: { quality: { score: 85 } },
    issues: [],
    timestamp: "2024-01-01T00:00:00Z",
  }));
};

const setupFileAnalysisScenario = (
  strategy: MockStrategy,
  analyzeFiles: ReturnType<typeof vi.fn<(files: string[]) => Promise<unknown[]>>>,
  filePaths: string[],
  includeAll: boolean = true,
) => {
  strategy.getFilesToAnalyze.mockResolvedValue(filePaths);
  const analysisResults = createFileAnalysisResults(filePaths, includeAll);
  analyzeFiles.mockResolvedValue(analysisResults);
  return analysisResults.length;
};

const expectNoFailure = () => {
  expect(mockCore.setFailed).not.toHaveBeenCalledWith("Some files were not analyzed.");
};

const expectFailure = () => {
  expect(mockCore.setFailed).toHaveBeenCalledWith("Some files were not analyzed.");
};

const expectFilesAnalyzedOutput = (count: number) => {
  expect(mockCore.setOutput).toHaveBeenCalledWith("files-analyzed", count.toString());
};

interface MockStrategy {
  getEventInfo: ReturnType<typeof vi.fn>;
  getFilesToAnalyze: ReturnType<typeof vi.fn<() => Promise<string[]>>>;
}

vi.mock("@actions/core", () => mockCore);

vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(() => ({
    rest: {
      repos: {
        getCommit: vi.fn(() =>
          Promise.resolve({
            data: {
              sha: "abc123456789",
              commit: {
                message: "test commit",
                author: { name: "Test User", date: "2024-01-15T10:30:00Z" },
              },
              files: [{ filename: "README.md", status: "modified" }],
            },
          }),
        ),
      },
    },
  })),
  context: {
    repo: { owner: "test-owner", repo: "test-repo" },
    sha: "abc123456789",
    eventName: "push",
  },
}));

const mockAnalyzeFiles = vi.fn<(files: string[]) => Promise<unknown[]>>();

vi.mock("../src/services/api-service.js", () => ({
  analyzeFiles: mockAnalyzeFiles,
  createConfig: vi.fn(() => ({})),
  getAnalysisSummary: vi.fn(() => ({
    totalFiles: 0,
    averageQualityScore: 0,
    averageClarityScore: 0,
    averageToneScore: 0,
  })),
}));

vi.mock("../src/services/post-analysis-service.js", () => ({
  handlePostAnalysisActions: vi.fn(() => Promise.resolve()),
}));

vi.mock("../src/utils/index.js", () => ({
  displayEventInfo: vi.fn(),
  displayFilesToAnalyze: vi.fn(),
  displayResults: vi.fn(),
  displaySectionHeader: vi.fn(),
  filterSupportedFiles: vi.fn((files: string[]) => files), // Return provided files as-is
  readFileContent: vi.fn(() => Promise.resolve("Test content")),
}));

const mockCreateFileDiscoveryStrategy = vi.fn<() => MockStrategy>();

vi.mock("../src/strategies/index.js", () => ({
  createFileDiscoveryStrategy: mockCreateFileDiscoveryStrategy,
}));

vi.mock("fs/promises", () => ({
  readFile: vi.fn(() => Promise.resolve("Test content")),
}));

const { runAction } = await import("../src/action-runner.js");

describe("Action Runner Tests", () => {
  let mockStrategy: MockStrategy;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStrategy = {
      getEventInfo: vi.fn(() => ({
        eventType: "push",
        filesCount: 0,
        repository: "test-owner/test-repo",
      })),
      getFilesToAnalyze: vi.fn(() => Promise.resolve([])),
    };

    mockCreateFileDiscoveryStrategy.mockReturnValue(mockStrategy);

    mockCore.getInput.mockImplementation(createInputMock("true"));
  });

  describe("when strict mode is enabled", () => {
    beforeEach(() => {
      mockCore.getInput.mockImplementation(createInputMock("true"));
    });

    it("should pass when all files are analyzed successfully", async () => {
      const testFiles = ["README.md", "src/main.ts", "docs/api.md"];
      const analyzedCount = setupFileAnalysisScenario(
        mockStrategy,
        mockAnalyzeFiles,
        testFiles,
        true,
      );

      await runAction();

      expectNoFailure();
      expectFilesAnalyzedOutput(analyzedCount);
    });

    it("should fail when some files are not analyzed", async () => {
      const testFiles = ["README.md", "src/main.ts", "docs/api.md"];
      const analyzedCount = setupFileAnalysisScenario(
        mockStrategy,
        mockAnalyzeFiles,
        testFiles,
        false,
      );

      await runAction();

      expectFailure();
      expectFilesAnalyzedOutput(analyzedCount);
    });

    it("should handle single file analysis correctly", async () => {
      const testFiles = ["README.md"];
      const analyzedCount = setupFileAnalysisScenario(
        mockStrategy,
        mockAnalyzeFiles,
        testFiles,
        true,
      );

      await runAction();

      expectNoFailure();
      expectFilesAnalyzedOutput(analyzedCount);
    });
  });

  describe("when strict mode is disabled", () => {
    beforeEach(() => {
      mockCore.getInput.mockImplementation(createInputMock("false"));
    });

    it("should pass even when some files are not analyzed", async () => {
      const testFiles = ["README.md", "src/main.ts", "docs/api.md"];
      const analyzedCount = setupFileAnalysisScenario(
        mockStrategy,
        mockAnalyzeFiles,
        testFiles,
        false,
      );

      await runAction();

      expectNoFailure();
      expectFilesAnalyzedOutput(analyzedCount);
    });
  });

  describe("when strict mode is not specified", () => {
    beforeEach(() => {
      mockCore.getInput.mockImplementation(createInputMockWithOverrides({ strict_mode: "" }));
    });

    it("should default to disabled and pass when some files are not analyzed", async () => {
      const testFiles = ["README.md", "src/main.ts", "docs/api.md"];
      const analyzedCount = setupFileAnalysisScenario(
        mockStrategy,
        mockAnalyzeFiles,
        testFiles,
        false,
      );

      await runAction();

      expectNoFailure();
      expectFilesAnalyzedOutput(analyzedCount);
    });
  });

  describe("edge cases", () => {
    it("should handle zero files found", async () => {
      mockCore.getInput.mockImplementation(createInputMock("true"));

      mockStrategy.getFilesToAnalyze.mockResolvedValue([]);

      await runAction();

      expect(mockCore.setOutput).toHaveBeenCalledWith("files-analyzed", "0");
      expect(mockCore.info).toHaveBeenCalledWith("No supported files found to analyze.");
    });

    it("should handle zero results from analysis", async () => {
      mockCore.getInput.mockImplementation(createInputMock("true"));

      mockStrategy.getFilesToAnalyze.mockResolvedValue(["README.md", "src/main.ts", "docs/api.md"]);

      // Mock analyzeFiles to return empty array (failed analysis)
      mockAnalyzeFiles.mockResolvedValue([]);

      await runAction();

      expect(mockCore.setFailed).toHaveBeenCalledWith("Failed to analyze supported files.");
    });

    it("should handle error with Error instance", async () => {
      mockCore.getInput.mockImplementation(createInputMock("true"));

      // Create an error instance
      const testError = new Error("Test error message");

      // Mock strategy to throw the error
      mockCreateFileDiscoveryStrategy.mockImplementation(() => {
        throw testError;
      });

      await runAction();

      expect(mockCore.setFailed).toHaveBeenCalledWith("Test error message");
    });

    it("should handle error with non-Error instance", async () => {
      mockCore.getInput.mockImplementation(createInputMock("true"));

      // Create a non-Error object
      const testError = { message: "Non-error object" };

      // Mock strategy to throw the non-Error (which gets converted to Error in handleError)
      // Using 'as unknown' to test non-Error handling path
      mockCreateFileDiscoveryStrategy.mockImplementation(() => {
        throw testError as unknown;
      });

      await runAction();

      expect(mockCore.setFailed).toHaveBeenCalledWith(
        "An unexpected error occurred: [object Object]",
      );
    });

    it("should handle strategy creation error", async () => {
      mockCore.getInput.mockImplementation(createInputMock("true"));

      // Mock createFileDiscoveryStrategy to throw an error
      mockCreateFileDiscoveryStrategy.mockImplementation(() => {
        throw new Error("Strategy creation failed");
      });

      await runAction();

      expect(mockCore.setFailed).toHaveBeenCalledWith("Strategy creation failed");
    });
  });
});
