import { describe, it, expect, vi, beforeEach } from "vitest";

const infoMock = vi.hoisted(() => vi.fn<(message: string) => void>());

vi.mock("@actions/core", () => ({
  info: infoMock,
  warning: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

import {
  displayEventInfo,
  displayFilesToAnalyze,
  displayResults,
  displaySectionHeader,
  displaySubsectionHeader,
} from "../../src/utils/display-utils.js";
import {
  buildAnalysisOptions,
  buildAnalysisResult,
  buildScores,
  severities,
} from "../test-helpers/scores.js";

function infoLines(): string[] {
  return infoMock.mock.calls.map(([msg]) => msg);
}

beforeEach(() => {
  infoMock.mockReset();
});

describe("displayEventInfo", () => {
  it("emits event type and additional info", () => {
    displayEventInfo({
      eventType: "push",
      description: "push event",
      filesCount: 3,
      additionalInfo: { commitSha: "abc" },
    });
    const lines = infoLines();
    expect(lines.some((l) => l.includes("push"))).toBe(true);
    expect(lines.some((l) => l.includes("commitSha"))).toBe(true);
  });
});

describe("displayFilesToAnalyze", () => {
  it("prints up to MAX_FILES_TO_SHOW entries and an overflow line", () => {
    const files = Array.from({ length: 12 }, (_, i) => `file-${i.toString()}.md`);
    displayFilesToAnalyze(files);
    const lines = infoLines();
    expect(lines.some((l) => l.includes("file-0.md"))).toBe(true);
    expect(lines.some((l) => l.includes("more files"))).toBe(true);
  });

  it("short-circuits on empty input", () => {
    displayFilesToAnalyze([]);
    expect(infoLines()).toContain("No files found to analyze.");
  });
});

describe("displayResults", () => {
  it("risk mode shows risk label, not score", () => {
    const result = buildAnalysisResult({ issues: severities("high", "medium") });
    displayResults([result], buildAnalysisOptions({ numericScoringEnabled: false }));
    const lines = infoLines();
    expect(lines.some((l) => l.includes("Risk"))).toBe(true);
    expect(lines.every((l) => !l.includes("Quality Score"))).toBe(true);
  });

  it("numeric mode shows quality score line", () => {
    const result = buildAnalysisResult({
      scores: buildScores({ score: 78 }),
      issues: severities("low"),
    });
    displayResults([result], buildAnalysisOptions({ numericScoringEnabled: true }));
    const lines = infoLines();
    expect(lines.some((l) => l.includes("Quality Score"))).toBe(true);
    expect(lines.some((l) => l.includes("78"))).toBe(true);
  });

  it("handles empty results array", () => {
    displayResults([], buildAnalysisOptions());
    expect(infoLines()).toContain("📊 No analysis results to display.");
  });
});

describe("displaySectionHeader/displaySubsectionHeader", () => {
  it("emits the title and a separator line", () => {
    displaySectionHeader("Hello");
    displaySubsectionHeader("World");
    const lines = infoLines();
    expect(lines.some((l) => l.includes("Hello"))).toBe(true);
    expect(lines.some((l) => l.includes("World"))).toBe(true);
  });
});
