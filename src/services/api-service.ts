/**
 * Style-agent analysis orchestration.
 *
 * For each file: read content, POST `/agents/<style_agent>/run`, poll the
 * workflow until terminal, and map the response into our `AnalysisResult`
 * shape. Files are processed with a concurrency cap to avoid hammering the API.
 */

import * as core from "@actions/core";
import {
  isFatalApiError,
  MarkupApiError,
  pollUntilDone,
  runStyleAgent,
} from "./markup-api-client.js";
import {
  AnalysisIssue,
  AnalysisOptions,
  AnalysisResult,
  AgentRunResponse,
  StyleAgentIssue,
} from "../types/index.js";
import { getFileBasename, getLineContextAtIndex } from "../utils/file-utils.js";
import { computeIssueCounts } from "../utils/issue-utils.js";
import { processWithConcurrency } from "../utils/batch-utils.js";
import { MAX_CONCURRENT_FILES } from "../constants/index.js";

function buildAnalysisIssues(
  content: string,
  issues: StyleAgentIssue[] | undefined,
): AnalysisIssue[] {
  if (!issues || issues.length === 0) return [];
  return issues.map((issue) => {
    const startIndex = issue.position?.start;
    if (typeof startIndex !== "number") {
      // No position → can't anchor an inline review comment. Surface with
      // line/column 0 so downstream code skips it for inline comments (which
      // require line > 0) but still counts it in summary totals.
      return { issue, line: 0, column: 0, lineText: "" };
    }
    const { line, column, lineText } = getLineContextAtIndex(content, startIndex);
    return { issue, line, column, lineText };
  });
}

function toAnalysisResult(
  filePath: string,
  content: string,
  response: AgentRunResponse,
): AnalysisResult {
  const issues = buildAnalysisIssues(content, response.result?.issues);
  return {
    filePath,
    workflowId: response.workflow_id,
    status: response.status,
    documentRef: response.document_ref ?? undefined,
    scores: response.result?.quality ?? null,
    analysis: response.result?.analysis ?? null,
    issues,
    issueCounts: computeIssueCounts(issues),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Run the style agent against a single file's content. Returns `null` on
 * non-fatal failure (timeout, per-file workflow failure). Throws on fatal
 * errors (401/403/5xx) so the caller can abort the whole run.
 */
export async function analyzeFile(
  apiKey: string,
  filePath: string,
  content: string,
  options: AnalysisOptions,
): Promise<AnalysisResult | null> {
  try {
    core.info(`🔍 Submitting ${filePath}`);
    const submission = await runStyleAgent(apiKey, {
      text: content,
      document_name: getFileBasename(filePath),
      document_ref: filePath,
      target_id: options.targetId,
    });

    core.info(`⏳ Polling workflow ${submission.workflow_id} for ${filePath}`);
    const finalState = await pollUntilDone(apiKey, submission.workflow_id);

    if (finalState.status !== "completed") {
      core.error(`Workflow for ${filePath} ended with status: ${finalState.status}`);
      return null;
    }

    return toAnalysisResult(filePath, content, finalState);
  } catch (error) {
    core.error(`Failed to analyze ${filePath}: ${String(error)}`);
    if (error instanceof MarkupApiError && isFatalApiError(error)) {
      throw error;
    }
    return null;
  }
}

/**
 * Analyze multiple files concurrently. Fatal API errors (401/403/5xx)
 * short-circuit the whole run: the first fatal error is captured, queued
 * tasks bail without making more API calls, and the error is rethrown so
 * the action surfaces it as a top-level failure. Per-file non-fatal failures
 * are logged and dropped from the result list.
 *
 * Note: `processWithConcurrency` uses `Promise.allSettled` internally, which
 * would swallow a raw `throw` from the processor. We catch the throw here,
 * set a shared abort flag, and let `processWithConcurrency` settle — then
 * rethrow once.
 */
export async function analyzeFiles(
  apiKey: string,
  files: string[],
  options: AnalysisOptions,
  readFileContent: (filePath: string) => Promise<string | null>,
): Promise<AnalysisResult[]> {
  if (files.length === 0) return [];

  core.info(
    `🚀 Analyzing ${files.length.toString()} file(s) with up to ${MAX_CONCURRENT_FILES.toString()} in flight`,
  );

  let fatalError: unknown = null;

  const results = await processWithConcurrency(
    files,
    async (filePath) => {
      // Already aborted by a peer task → skip without doing any work.
      if (fatalError) return null;
      const content = await readFileContent(filePath);
      if (content === null) return null;
      try {
        return await analyzeFile(apiKey, filePath, content, options);
      } catch (error) {
        if (isFatalApiError(error)) {
          // First fatal error wins; later ones are silently ignored.
          fatalError ??= error;
        }
        return null;
      }
    },
    MAX_CONCURRENT_FILES,
  );

  if (fatalError !== null) {
    if (fatalError instanceof Error) throw fatalError;
    let detail = "(unstringifiable error)";
    try {
      detail = JSON.stringify(fatalError);
    } catch {
      // Keep fallback. Circular refs / BigInt values can throw here.
    }
    throw new Error(`Fatal API error: ${detail}`);
  }

  return results.filter((r): r is AnalysisResult => r !== null);
}
