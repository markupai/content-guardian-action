import { describe, it, expect } from "vitest";
import {
  generateAnalysisContent,
  generateFooter,
  generatePerGoalDetails,
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

describe("generatePerGoalDetails", () => {
  it("returns empty string in risk mode", () => {
    const result = buildAnalysisResult({
      scores: buildScores({
        score: 80,
        scoresByGoal: [{ id: "g1", displayName: "Clarity", score: 78, count: 2 }],
      }),
    });
    expect(
      generatePerGoalDetails([result], buildAnalysisOptions({ numericScoringEnabled: false })),
    ).toBe("");
  });

  it("returns empty string in numeric mode when no scoresByGoal data is present", () => {
    const result = buildAnalysisResult({ scores: buildScores({ score: 80 }) });
    expect(
      generatePerGoalDetails([result], buildAnalysisOptions({ numericScoringEnabled: true })),
    ).toBe("");
  });

  it("renders a <details> block with per-file per-goal scores when present", () => {
    const results = [
      buildAnalysisResult({
        filePath: "README.md",
        scores: buildScores({
          score: 74,
          scoresByGoal: [
            { id: "clarity", displayName: "Clarity", score: 78.4, count: 3 },
            { id: "grammar", displayName: "Grammar", score: 91, count: 1 },
            { id: "tone", displayName: "Tone", score: 62, count: 4 },
          ],
        }),
      }),
      buildAnalysisResult({
        filePath: "docs/api.md",
        scores: buildScores({
          score: 52,
          scoresByGoal: [
            { id: "clarity", displayName: "Clarity", score: 60, count: 6 },
            { id: "grammar", displayName: "Grammar", score: 55, count: 5 },
          ],
        }),
      }),
    ];
    const output = generatePerGoalDetails(
      results,
      buildAnalysisOptions({ numericScoringEnabled: true }),
    );
    expect(output).toMatch(/<details>/);
    expect(output).toMatch(/<\/details>/);
    expect(output).toMatch(/Per-goal breakdown/);
    expect(output).toMatch(/\*\*README.md\*\* — Clarity 78 · Grammar 91 · Tone 62/);
    expect(output).toMatch(/\*\*docs\/api.md\*\* — Clarity 60 · Grammar 55/);
  });

  it("skips files with no scoresByGoal but still renders the block when at least one file has data", () => {
    const results = [
      buildAnalysisResult({ filePath: "a.md", scores: buildScores({ score: 80 }) }),
      buildAnalysisResult({
        filePath: "b.md",
        scores: buildScores({
          score: 70,
          scoresByGoal: [{ id: "g", displayName: "Clarity", score: 70, count: 1 }],
        }),
      }),
    ];
    const output = generatePerGoalDetails(
      results,
      buildAnalysisOptions({ numericScoringEnabled: true }),
    );
    expect(output).toMatch(/\*\*b.md\*\*/);
    expect(output).not.toMatch(/\*\*a.md\*\*/);
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

  it("inserts the per-goal details between table and summary in numeric mode", () => {
    const result = buildAnalysisResult({
      filePath: "README.md",
      scores: buildScores({
        score: 80,
        scoresByGoal: [{ id: "c", displayName: "Clarity", score: 80, count: 1 }],
      }),
    });
    const content = generateAnalysisContent(
      [result],
      buildAnalysisOptions({ numericScoringEnabled: true }),
      "## Header",
      "pull_request",
      repo,
    );
    const tableIdx = content.indexOf("| Quality |");
    const detailsIdx = content.indexOf("<details>");
    const summaryIdx = content.indexOf("Overall Quality Score");
    expect(tableIdx).toBeGreaterThan(-1);
    expect(detailsIdx).toBeGreaterThan(tableIdx);
    expect(summaryIdx).toBeGreaterThan(detailsIdx);
  });
});
