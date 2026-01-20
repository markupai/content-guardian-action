/**
 * Unit tests for action configuration functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as core from "../mocks/core.js";
import type { ActionConfig, AnalysisOptions } from "../../src/types/index.js";

// Mock dependencies
vi.mock("@actions/core", () => core);

const { getActionConfig, getAnalysisOptions, validateConfig, logConfiguration } =
  await import("../../src/config/action-config.js");

describe("Action Config", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset environment variables
    delete process.env.MARKUP_AI_API_KEY;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_REPOSITORY;
  });

  afterEach(() => {
    delete process.env.MARKUP_AI_API_KEY;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_REPOSITORY;
  });

  describe("getAnalysisOptions", () => {
    it("should return analysis options with provided values", () => {
      const config: ActionConfig = {
        dialect: "british_english",
        tone: "informal",
        styleGuide: "chicago",
        apiToken: "token",
        githubToken: "github-token",
        addCommitStatus: true,
        addReviewComments: true,
        strictMode: false,
      };

      const options: AnalysisOptions = getAnalysisOptions(config);

      expect(options).toEqual({
        dialect: "british_english",
        tone: "informal",
        styleGuide: "chicago",
        reviewComments: true,
      });
    });

    it("should return analysis options as provided in config", () => {
      const config: ActionConfig = {
        dialect: "",
        tone: undefined as unknown as string,
        styleGuide: "",
        apiToken: "token",
        githubToken: "github-token",
        addCommitStatus: true,
        addReviewComments: true,
        strictMode: false,
      };

      const options: AnalysisOptions = getAnalysisOptions(config);

      expect(options).toEqual({
        dialect: "",
        tone: undefined,
        styleGuide: "",
        reviewComments: true,
      });
    });
  });

  describe("validateConfig", () => {
    it("should not throw error for valid config", () => {
      const config: ActionConfig = {
        dialect: "american_english",
        tone: "formal",
        styleGuide: "ap",
        apiToken: "valid-token",
        githubToken: "valid-github-token",
        addCommitStatus: true,
        addReviewComments: true,
        strictMode: false,
      };

      expect(() => {
        validateConfig(config);
      }).not.toThrow();
    });

    it("should throw error for missing token", () => {
      const config: ActionConfig = {
        dialect: "american_english",
        tone: "formal",
        styleGuide: "ap",
        apiToken: "",
        githubToken: "valid-github-token",
        addCommitStatus: true,
        addReviewComments: true,
        strictMode: false,
      };

      expect(() => {
        validateConfig(config);
      }).toThrow("API token is required");
    });

    it("should warn for missing GitHub token", () => {
      const config: ActionConfig = {
        dialect: "american_english",
        tone: "formal",
        styleGuide: "ap",
        apiToken: "valid-token",
        githubToken: "",
        addCommitStatus: true,
        addReviewComments: true,
        strictMode: false,
      };

      expect(() => {
        validateConfig(config);
      }).not.toThrow();
      expect(core.warning).toHaveBeenCalled();
    });

    it("should throw error for empty dialect", () => {
      const config: ActionConfig = {
        dialect: "",
        tone: "formal",
        styleGuide: "ap",
        apiToken: "valid-token",
        githubToken: "valid-github-token",
        addCommitStatus: true,
        addReviewComments: true,
        strictMode: false,
      };

      expect(() => {
        validateConfig(config);
      }).toThrow("Analysis option 'dialect' cannot be empty");
    });

    // tone is optional now

    it("should throw error for empty style guide", () => {
      const config: ActionConfig = {
        dialect: "american_english",
        tone: "formal",
        styleGuide: "",
        apiToken: "valid-token",
        githubToken: "valid-github-token",
        addCommitStatus: true,
        addReviewComments: true,
        strictMode: false,
      };

      expect(() => {
        validateConfig(config);
      }).toThrow("Analysis option 'style_guide' cannot be empty");
    });
  });

  describe("logConfiguration", () => {
    it("should log configuration correctly", () => {
      const config: ActionConfig = {
        dialect: "british_english",
        tone: "informal",
        styleGuide: "chicago",
        apiToken: "token123",
        githubToken: "github-token123",
        addCommitStatus: true,
        addReviewComments: false,
        strictMode: false,
      };

      logConfiguration(config);

      expect(core.info).toHaveBeenCalledWith("🔧 Action Configuration:");
      expect(core.info).toHaveBeenCalledWith("  Dialect: british_english");
      expect(core.info).toHaveBeenCalledWith("  Tone: informal");
      expect(core.info).toHaveBeenCalledWith("  Style Guide: chicago");
      expect(core.info).toHaveBeenCalledWith("  API Token: [PROVIDED]");
      expect(core.info).toHaveBeenCalledWith("  GitHub Token: [PROVIDED]");
      expect(core.info).toHaveBeenCalledWith("  Review Comments: disabled");
    });

    it("should log empty values when not provided", () => {
      const config: ActionConfig = {
        dialect: "",
        tone: undefined as unknown as string,
        styleGuide: "",
        apiToken: "token123",
        githubToken: "github-token123",
        addCommitStatus: true,
        addReviewComments: true,
        strictMode: false,
      };

      logConfiguration(config);

      expect(core.info).toHaveBeenCalledWith("  Dialect: ");
      expect(core.info).toHaveBeenCalledWith("  Tone: ");
      expect(core.info).toHaveBeenCalledWith("  Style Guide: ");
    });
  });

  describe("getActionConfig", () => {
    it("should return complete config from inputs", () => {
      core.getInput
        .mockReturnValueOnce("markup_ai_api_key") // markup_ai_api_key
        .mockReturnValueOnce("github-token") // github_token
        .mockReturnValueOnce("british_english") // dialect
        .mockReturnValueOnce("informal") // tone
        .mockReturnValueOnce("chicago"); // style-guide

      const config: ActionConfig = getActionConfig();

      expect(config).toEqual({
        dialect: "british_english",
        tone: "informal",
        styleGuide: "chicago",
        apiToken: "markup_ai_api_key",
        githubToken: "github-token",
        addCommitStatus: true,
        addReviewComments: true,
        strictMode: false,
      });
    });

    it("should return config with environment variables when inputs are empty", () => {
      core.getInput.mockReturnValue("");
      process.env.MARKUP_AI_API_KEY = "env-markup-ai-api-key";
      process.env.GITHUB_TOKEN = "env-github-token";
      process.env.DIALECT = "american_english";
      process.env.STYLE_GUIDE = "ap";

      const config: ActionConfig = getActionConfig();

      expect(config).toEqual({
        dialect: "american_english",
        tone: undefined,
        styleGuide: "ap",
        apiToken: "env-markup-ai-api-key",
        githubToken: "env-github-token",
        addCommitStatus: true,
        addReviewComments: true,
        strictMode: false,
      });
    });

    it("should prioritize inputs over environment variables", () => {
      core.getInput
        .mockReturnValueOnce("input-markup-ai-api-key") // markup_ai_api_key
        .mockReturnValueOnce("input-github-token") // github_token
        .mockReturnValueOnce("british_english") // dialect
        .mockReturnValueOnce("informal") // tone
        .mockReturnValueOnce("chicago"); // style-guide

      process.env.MARKUP_AI_API_KEY = "env-markup-ai-api-key";
      process.env.GITHUB_TOKEN = "env-github-token";

      const config: ActionConfig = getActionConfig();

      expect(config.apiToken).toBe("input-markup-ai-api-key");
      expect(config.githubToken).toBe("input-github-token");
    });

    // defaults removed for dialect/style-guide; tone optional with no default

    it("should throw error when required tokens are missing", () => {
      core.getInput.mockReturnValue("");

      expect(() => getActionConfig()).toThrow(
        "Required input 'markup_ai_api_key' or environment variable 'MARKUP_AI_API_KEY' is not provided",
      );
    });
  });
});
