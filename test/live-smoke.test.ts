/**
 * Live smoke test against api.markup.ai.
 * Skipped unless MARKUP_AI_LIVE_KEY is set.
 *
 * This is not run in CI; it's for manual verification by maintainers
 * before merging code that touches the API client.
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import {
  assertStyleAgentEnabled,
  getStyleAgentConfig,
  listStyleGuides,
} from "../src/services/markup-api-client.js";
import { resolveStyleGuide } from "../src/services/style-guide-resolver.js";
import { analyzeFile } from "../src/services/api-service.js";

const apiKey = process.env.MARKUP_AI_LIVE_KEY;
const liveTest = apiKey ? describe : describe.skip;

liveTest("live API smoke (gated by MARKUP_AI_LIVE_KEY)", () => {
  it("walks the full action flow against api.markup.ai", { timeout: 60_000 }, async () => {
    const key = apiKey as string;
    const config = await getStyleAgentConfig(key);
    expect(config.style_agent).toMatch(/enabled/);
    assertStyleAgentEnabled(config);

    const styleGuides = await listStyleGuides(key);
    expect(styleGuides.length).toBeGreaterThan(0);
    const styleGuide = styleGuides.find((sg) => sg.is_default) ?? styleGuides[0];
    const resolved = resolveStyleGuide(styleGuide.display_name, styleGuides);
    expect(resolved.id).toBe(styleGuide.id);

    const sample = await fs.readFile(
      path.join(import.meta.dirname, "..", "testdata", "markdown", "sample-data-1.md"),
      "utf-8",
    );

    const result = await analyzeFile(key, "sample-data-1.md", sample, {
      styleGuideId: resolved.id,
      styleGuideDisplayName: resolved.display_name,
      numericScoringEnabled: config.style_agent_numeric_scoring,
    });

    expect(result).not.toBeNull();
    expect(result?.status).toBe("completed");
    expect(result?.workflowId).toMatch(/^agw_/);
    expect(result?.issueCounts.total).toBeGreaterThanOrEqual(0);

    console.log(
      "live smoke result:",
      JSON.stringify(
        {
          numericScoringEnabled: config.style_agent_numeric_scoring,
          workflow: result?.workflowId,
          status: result?.status,
          counts: result?.issueCounts,
          scores: result?.scores,
          first_issue: result?.issues[0]?.issue.category,
        },
        null,
        2,
      ),
    );
  });
});
