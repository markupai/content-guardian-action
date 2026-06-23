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
  delete process.env.STYLE_GUIDE;
});

afterEach(() => {
  delete process.env.MARKUP_AI_API_KEY;
  delete process.env.GITHUB_TOKEN;
  delete process.env.STYLE_GUIDE;
});

function baseConfig(overrides: Partial<ActionConfig> = {}): ActionConfig {
  return {
    apiToken: "token",
    githubToken: "ghtok",
    styleGuide: "",
    paths: [],
    addCommitStatus: true,
    addReviewComments: true,
    strictMode: false,
    dryRun: false,
    ...overrides,
  };
}

describe("validateConfig", () => {
  // `validateConfig` is intentionally a no-op now — input-time validation in
  // `getActionConfig` (via `getRequiredInput`) covers everything that was
  // previously asserted here. Kept as an extension point for future
  // invariants.
  it("does not throw for any valid-shape ActionConfig", () => {
    expect(() => {
      validateConfig(baseConfig());
    }).not.toThrow();
    expect(() => {
      validateConfig(baseConfig({ styleGuide: "Main" }));
    }).not.toThrow();
    expect(() => {
      validateConfig(baseConfig({ apiToken: "" }));
    }).not.toThrow();
    expect(() => {
      validateConfig(baseConfig({ githubToken: "" }));
    }).not.toThrow();
  });
});

describe("logConfiguration", () => {
  it("logs an explicit style guide value when provided", () => {
    logConfiguration(baseConfig({ styleGuide: "Brand Voice" }));
    const messages = core.info.mock.calls.map(([m]) => m);
    expect(messages.some((m) => m.includes("Brand Voice"))).toBe(true);
    expect(messages.some((m) => m.includes("[PROVIDED]"))).toBe(true);
  });

  it("shows '(org default)' when style guide is empty", () => {
    logConfiguration(baseConfig({ styleGuide: "" }));
    const messages = core.info.mock.calls.map(([m]) => m);
    expect(messages.some((m) => m.includes("(org default)"))).toBe(true);
  });
});

function inputs(map: Record<string, string>) {
  core.getInput.mockImplementation((name: string) => map[name] ?? "");
}

describe("getActionConfig", () => {
  it("reads inputs and returns a complete config", () => {
    inputs({
      markup_ai_api_key: "tok",
      github_token: "gh",
      style_guide: "Marketing Voice",
    });
    expect(getActionConfig()).toEqual({
      apiToken: "tok",
      githubToken: "gh",
      styleGuide: "Marketing Voice",
      paths: [],
      addCommitStatus: true,
      addReviewComments: true,
      strictMode: false,
      dryRun: false,
    });
  });

  it("parses comma-separated paths input", () => {
    inputs({
      markup_ai_api_key: "tok",
      github_token: "gh",
      paths: "README.md, docs/intro.md , ",
    });
    expect(getActionConfig().paths).toEqual(["README.md", "docs/intro.md"]);
  });

  it("parses newline-separated paths input", () => {
    inputs({
      markup_ai_api_key: "tok",
      github_token: "gh",
      paths: "README.md\ndocs/intro.md\n\n",
    });
    expect(getActionConfig().paths).toEqual(["README.md", "docs/intro.md"]);
  });

  it("returns empty paths array when no paths input is given", () => {
    inputs({ markup_ai_api_key: "tok", github_token: "gh" });
    expect(getActionConfig().paths).toEqual([]);
  });

  it("falls back to env vars when inputs are empty", () => {
    core.getInput.mockReturnValue("");
    process.env.MARKUP_AI_API_KEY = "env-tok";
    process.env.GITHUB_TOKEN = "env-gh";
    process.env.STYLE_GUIDE = "Brand Voice";
    expect(getActionConfig().apiToken).toBe("env-tok");
    expect(getActionConfig().styleGuide).toBe("Brand Voice");
  });

  it("inputs take precedence over env vars", () => {
    inputs({
      markup_ai_api_key: "input-tok",
      github_token: "input-gh",
      style_guide: "Input Style Guide",
    });
    process.env.MARKUP_AI_API_KEY = "env-tok";
    expect(getActionConfig().apiToken).toBe("input-tok");
  });

  it("throws when api key is missing", () => {
    core.getInput.mockReturnValue("");
    expect(() => getActionConfig()).toThrow(/Required input 'markup_ai_api_key'/);
  });

  it("returns empty style guide when no style guide is provided (action will use org default)", () => {
    inputs({ markup_ai_api_key: "tok", github_token: "gh" });
    expect(getActionConfig().styleGuide).toBe("");
  });

  it("parses strict_mode and add_* as booleans", () => {
    inputs({
      markup_ai_api_key: "tok",
      github_token: "gh",
      style_guide: "Brand Voice",
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
