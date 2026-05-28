import { describe, it, expect } from "vitest";
import {
  generateAnalysisContent,
  generateFooter,
  generateResultsTable,
  generateSummary,
  RepositoryContext,
} from "../../src/utils/markdown-utils.js";
import {
  buildAnalysisOptions,
  buildAnalysisResult,
  buildScores,
  severities,
} from "../test-helpers/scores.js";

const repo: RepositoryContext = {
  owner: "octo",
  repo: "demo",
  ref: "refs/heads/main",
  baseUrl: new URL("https://github.com"),
  runId: 42,
};

const prRepo: RepositoryContext = { ...repo, prNumber: 7 };

describe("generateResultsTable", () => {
  it("risk mode header lists Risk column, not Quality", () => {
    const table = generateResultsTable(
      [buildAnalysisResult({ issues: severities("high") })],
      buildAnalysisOptions({ numericScoringEnabled: false }),
      repo,
    );
    expect(table).toMatch(/\| Risk \|/);
    expect(table).not.toMatch(/\| Quality \|/);
  });

  it("numeric mode header lists Quality column", () => {
    const table = generateResultsTable(
      [
        buildAnalysisResult({
          scores: buildScores({ score: 87 }),
          issues: severities("low"),
        }),
      ],
      buildAnalysisOptions({ numericScoringEnabled: true }),
      repo,
    );
    expect(table).toMatch(/\| Quality \|/);
    expect(table).toMatch(/87/);
  });

  it("renders an empty marker for no results", () => {
    expect(generateResultsTable([], buildAnalysisOptions(), repo)).toMatch(/No files/);
  });

  it("uses PR diff anchor when context has prNumber", () => {
    const table = generateResultsTable(
      [buildAnalysisResult({ filePath: "src/file.md" })],
      buildAnalysisOptions(),
      prRepo,
    );
    expect(table).toMatch(/\/pull\/7\/files#diff-/);
  });

  it("uses blob link when context is non-PR", () => {
    const table = generateResultsTable(
      [buildAnalysisResult({ filePath: "src/file.md" })],
      buildAnalysisOptions(),
      repo,
    );
    expect(table).toMatch(/\/blob\/refs\/heads\/main\/src\/file.md/);
  });
});

describe("generateSummary", () => {
  it("risk mode summary leads with Overall Risk", () => {
    const summary = generateSummary(
      [buildAnalysisResult({ issues: severities("medium") })],
      buildAnalysisOptions({ numericScoringEnabled: false }),
    );
    expect(summary).toMatch(/Overall Risk/);
    expect(summary).not.toMatch(/Overall Quality Score/);
  });

  it("numeric mode summary leads with Overall Quality Score", () => {
    const summary = generateSummary(
      [
        buildAnalysisResult({ scores: buildScores({ score: 90 }) }),
        buildAnalysisResult({ scores: buildScores({ score: 70 }) }),
      ],
      buildAnalysisOptions({ numericScoringEnabled: true }),
    );
    expect(summary).toMatch(/Overall Quality Score/);
    expect(summary).toMatch(/80/);
  });

  it("returns empty string when no results", () => {
    expect(generateSummary([], buildAnalysisOptions())).toBe("");
  });
});

describe("generateFooter", () => {
  it("labels the scoring mode", () => {
    expect(generateFooter(buildAnalysisOptions({ numericScoringEnabled: true }), "push")).toMatch(
      /Numeric scoring/,
    );
    expect(generateFooter(buildAnalysisOptions({ numericScoringEnabled: false }), "push")).toMatch(
      /Risk-based/,
    );
  });

  it("includes the target display name", () => {
    expect(
      generateFooter(buildAnalysisOptions({ targetDisplayName: "Brand Voice" }), "push"),
    ).toMatch(/Brand Voice/);
  });
});

describe("generateAnalysisContent", () => {
  it("wraps table + summary + footer below a header", () => {
    const content = generateAnalysisContent(
      [buildAnalysisResult({ issues: severities("low") })],
      buildAnalysisOptions(),
      "## My Header",
      "push",
      repo,
    );
    expect(content).toMatch(/My Header/);
    expect(content).toMatch(/Overall Risk/);
    expect(content).toMatch(/Risk-based/);
  });
});
