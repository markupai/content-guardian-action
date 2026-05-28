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
    const startIndex = issue.position?.start ?? 0;
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
 * Analyze multiple files concurrently. Fatal API errors short-circuit; per-file
 * failures are logged and dropped from the result list.
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

  const results = await processWithConcurrency(
    files,
    async (filePath) => {
      const content = await readFileContent(filePath);
      if (content === null) return null;
      return analyzeFile(apiKey, filePath, content, options);
    },
    MAX_CONCURRENT_FILES,
  );

  return results.filter((r): r is AnalysisResult => r !== null);
}
