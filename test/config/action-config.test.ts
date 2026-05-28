import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as core from "../mocks/core.js";
import type { ActionConfig } from "../../src/types/index.js";

vi.mock("@actions/core", () => core);

const { getActionConfig, validateConfig, logConfiguration } =
  await import("../../src/config/action-config.js");

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.MARKUP_AI_API_KEY;
  delete process.env.GITHUB_TOKEN;
  delete process.env.TARGET;
});

afterEach(() => {
  delete process.env.MARKUP_AI_API_KEY;
  delete process.env.GITHUB_TOKEN;
  delete process.env.TARGET;
});

function baseConfig(overrides: Partial<ActionConfig> = {}): ActionConfig {
  return {
    apiToken: "token",
    githubToken: "ghtok",
    target: "Marketing Voice",
    addCommitStatus: true,
    addReviewComments: true,
    strictMode: false,
    ...overrides,
  };
}

describe("validateConfig", () => {
  it("passes for a valid config", () => {
    expect(() => {
      validateConfig(baseConfig());
    }).not.toThrow();
  });

  it("throws when API token is missing", () => {
    expect(() => {
      validateConfig(baseConfig({ apiToken: "" }));
    }).toThrow(/API token/);
  });

  it("warns when GitHub token is missing but does not throw", () => {
    expect(() => {
      validateConfig(baseConfig({ githubToken: "" }));
    }).not.toThrow();
    expect(core.warning).toHaveBeenCalled();
  });

  it("throws when target is empty", () => {
    expect(() => {
      validateConfig(baseConfig({ target: "  " }));
    }).toThrow(/target/);
  });
});

describe("logConfiguration", () => {
  it("logs target and token status", () => {
    logConfiguration(baseConfig({ target: "Brand Voice" }));
    const messages = core.info.mock.calls.map(([m]) => m);
    expect(messages.some((m) => m.includes("Brand Voice"))).toBe(true);
    expect(messages.some((m) => m.includes("[PROVIDED]"))).toBe(true);
  });
});

describe("getActionConfig", () => {
  function inputs(map: Record<string, string>) {
    core.getInput.mockImplementation((name: string) => map[name] ?? "");
  }

  it("reads inputs and returns a complete config", () => {
    inputs({
      markup_ai_api_key: "tok",
      github_token: "gh",
      target: "Marketing Voice",
    });
    expect(getActionConfig()).toEqual({
      apiToken: "tok",
      githubToken: "gh",
      target: "Marketing Voice",
      addCommitStatus: true,
      addReviewComments: true,
      strictMode: false,
    });
  });

  it("falls back to env vars when inputs are empty", () => {
    core.getInput.mockReturnValue("");
    process.env.MARKUP_AI_API_KEY = "env-tok";
    process.env.GITHUB_TOKEN = "env-gh";
    process.env.TARGET = "Brand Voice";
    expect(getActionConfig().apiToken).toBe("env-tok");
    expect(getActionConfig().target).toBe("Brand Voice");
  });

  it("inputs take precedence over env vars", () => {
    inputs({
      markup_ai_api_key: "input-tok",
      github_token: "input-gh",
      target: "Input Target",
    });
    process.env.MARKUP_AI_API_KEY = "env-tok";
    expect(getActionConfig().apiToken).toBe("input-tok");
  });

  it("throws when api key is missing", () => {
    core.getInput.mockReturnValue("");
    expect(() => getActionConfig()).toThrow(/Required input 'markup_ai_api_key'/);
  });

  it("throws when target is missing", () => {
    inputs({ markup_ai_api_key: "tok", github_token: "gh" });
    expect(() => getActionConfig()).toThrow(/Required input 'target'/);
  });

  it("parses strict_mode and add_* as booleans", () => {
    inputs({
      markup_ai_api_key: "tok",
      github_token: "gh",
      target: "Brand Voice",
      strict_mode: "true",
      add_commit_status: "false",
      add_review_comments: "false",
    });
    const cfg = getActionConfig();
    expect(cfg.strictMode).toBe(true);
    expect(cfg.addCommitStatus).toBe(false);
    expect(cfg.addReviewComments).toBe(false);
  });
});
