import { describe, it, expect, vi, beforeEach } from "vitest";

const summary = vi.hoisted(() => ({
  addHeading: vi.fn(),
  addRaw: vi.fn(),
  write: vi.fn(),
}));

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  summary: {
    addHeading: summary.addHeading,
    addRaw: summary.addRaw,
    write: summary.write,
  },
}));

import { createJobSummary } from "../../src/services/job-summary-service.js";
import {
  buildAnalysisOptions,
  buildAnalysisResult,
  buildScores,
  severities,
} from "../test-helpers/scores.js";
import type { RepositoryContext } from "../../src/utils/markdown-utils.js";

const ctx: RepositoryContext = {
  owner: "octo",
  repo: "demo",
  ref: "refs/heads/main",
  baseUrl: new URL("https://github.com"),
  runId: 1,
};

beforeEach(() => {
  summary.addHeading.mockReset().mockReturnValue(summary);
  summary.addRaw.mockReset().mockReturnValue(summary);
  summary.write.mockReset().mockResolvedValue(undefined);
});

describe("createJobSummary", () => {
  it("renders a no-files header when results are empty", async () => {
    await createJobSummary([], buildAnalysisOptions(), "schedule", ctx);
    expect(summary.addHeading).toHaveBeenCalled();
    expect(summary.addRaw).toHaveBeenCalledWith("No files were analyzed.");
  });

  it("renders the risk-mode summary when numeric scoring is off", async () => {
    await createJobSummary(
      [buildAnalysisResult({ issues: severities("high", "medium") })],
      buildAnalysisOptions({ numericScoringEnabled: false }),
      "schedule",
      ctx,
    );
    const written = (summary.addRaw.mock.calls[0]?.[0] as string | undefined) ?? "";
    expect(written).toMatch(/Overall Risk/);
    expect(written).not.toMatch(/Overall Quality Score/);
  });

  it("renders the numeric summary when numeric scoring is on", async () => {
    await createJobSummary(
      [buildAnalysisResult({ scores: buildScores({ score: 70 }) })],
      buildAnalysisOptions({ numericScoringEnabled: true }),
      "schedule",
      ctx,
    );
    const written = (summary.addRaw.mock.calls[0]?.[0] as string | undefined) ?? "";
    expect(written).toMatch(/Overall Quality Score/);
  });
});
