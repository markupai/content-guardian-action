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
  buildAnalysisIssue,
  buildAnalysisOptions,
  buildAnalysisResult,
  buildIssue,
  buildScores,
  severities,
} from "../test-helpers/scores.js";

function buildAnalysisIssueFromHelper(overrides: { agent?: string }) {
  return buildAnalysisIssue({ issue: buildIssue({ agent: overrides.agent }) });
}

const repo: RepositoryContext = {
  owner: "octo",
  repo: "demo",
  ref: "refs/heads/main",
  baseUrl: new URL("https://github.com"),
  runId: 42,
};

const prRepo: RepositoryContext = { ...repo, prNumber: 7 };

describe("generateResultsTable", () => {
  it("risk mode header lists Risk column only (no Quality)", () => {
    const table = generateResultsTable(
      [buildAnalysisResult({ issues: severities("high") })],
      buildAnalysisOptions({ numericScoringEnabled: false }),
      repo,
    );
    expect(table).toMatch(/\| Risk \|/);
    expect(table).not.toMatch(/\| Quality \|/);
  });

  it("numeric mode header keeps Risk and appends Quality", () => {
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
    // Both columns must be present — risk is primary, quality is additional.
    expect(table).toMatch(/\| Risk \|/);
    expect(table).toMatch(/\| Quality \|/);
    expect(table).toMatch(/87/);
  });

  it("numeric mode row places risk first and quality last", () => {
    const table = generateResultsTable(
      [
        buildAnalysisResult({
          filePath: "x.md",
          scores: buildScores({ score: 87 }),
          issues: severities("medium"),
        }),
      ],
      buildAnalysisOptions({ numericScoringEnabled: true }),
      repo,
    );
    const dataRow = table.split("\n").find((l) => l.includes("x.md"));
    if (!dataRow) throw new Error("expected to find row for x.md");
    // The Quality cell ("87") must come after the Risk cell ("Medium").
    expect(dataRow.indexOf("Medium")).toBeLessThan(dataRow.indexOf("87"));
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
  it("risk mode summary shows Overall Risk only (no Quality Score line)", () => {
    const summary = generateSummary(
      [buildAnalysisResult({ issues: severities("medium") })],
      buildAnalysisOptions({ numericScoringEnabled: false }),
    );
    expect(summary).toMatch(/Overall Risk/);
    expect(summary).not.toMatch(/Overall Quality Score/);
  });

  it("numeric mode shows Overall Risk AND Overall Quality Score (layered, risk first)", () => {
    const summary = generateSummary(
      [
        buildAnalysisResult({
          issues: severities("medium"),
          scores: buildScores({ score: 90 }),
        }),
        buildAnalysisResult({ scores: buildScores({ score: 70 }) }),
      ],
      buildAnalysisOptions({ numericScoringEnabled: true }),
    );
    expect(summary).toMatch(/Overall Risk/);
    expect(summary).toMatch(/Overall Quality Score/);
    expect(summary).toMatch(/80/);
    // Risk is primary — must appear before the quality line.
    expect(summary.indexOf("Overall Risk")).toBeLessThan(summary.indexOf("Overall Quality Score"));
  });

  it("numeric mode without any scoresByGoal data still emits the risk line and skips quality", () => {
    const summary = generateSummary(
      [buildAnalysisResult({ scores: null, issues: severities("low") })],
      buildAnalysisOptions({ numericScoringEnabled: true }),
    );
    expect(summary).toMatch(/Overall Risk/);
    expect(summary).not.toMatch(/Overall Quality Score/);
  });

  it("returns empty string when no results", () => {
    expect(generateSummary([], buildAnalysisOptions())).toBe("");
  });
});

describe("generateFooter", () => {
  it("does not include scoring-mode wording (Mode line was removed)", () => {
    const numeric = generateFooter(
      [],
      buildAnalysisOptions({ numericScoringEnabled: true }),
      "push",
    );
    const risk = generateFooter([], buildAnalysisOptions({ numericScoringEnabled: false }), "push");
    expect(numeric).not.toMatch(/Mode:/);
    expect(numeric).not.toMatch(/Numeric scoring/);
    expect(risk).not.toMatch(/Mode:/);
    expect(risk).not.toMatch(/Risk-based scoring/);
  });

  it("includes the target display name", () => {
    expect(
      generateFooter([], buildAnalysisOptions({ targetDisplayName: "Brand Voice" }), "push"),
    ).toMatch(/Brand Voice/);
  });

  it("includes the event type", () => {
    expect(generateFooter([], buildAnalysisOptions(), "pull_request")).toMatch(/pull_request/);
  });

  it("includes an 'Agents run' line listing the agents that produced issues", () => {
    const result = buildAnalysisResult({
      issues: [
        buildAnalysisIssueFromHelper({ agent: "style_agent" }),
        buildAnalysisIssueFromHelper({ agent: "terminology" }),
      ],
    });
    const footer = generateFooter([result], buildAnalysisOptions(), "push");
    expect(footer).toMatch(/Agents run:.*Style Agent/);
    expect(footer).toMatch(/Terminology/);
  });

  it("omits the 'Agents run' line when no issues carry an agent tag", () => {
    const result = buildAnalysisResult({
      issues: [buildAnalysisIssueFromHelper({ agent: undefined })],
    });
    const footer = generateFooter([result], buildAnalysisOptions(), "push");
    expect(footer).not.toMatch(/Agents run:/);
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
    expect(content).not.toMatch(/Mode:/);
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
