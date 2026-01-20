import * as core from "@actions/core";
import {
  styleCheck,
  styleBatchCheckRequests,
  Config,
  StyleAnalysisReq,
  PlatformType,
  Environment,
} from "@markupai/toolkit";
import { AnalysisResult, AnalysisOptions } from "../types/index.js";
import { getFileBasename } from "../utils/file-utils.js";
import { calculateScoreSummary, ScoreSummary } from "../utils/score-utils.js";
import { processFileReading } from "../utils/batch-utils.js";
import { checkForRequestEndingError, isRequestEndingError } from "../utils/error-utils.js";

export function createConfig(apiToken: string): Config {
  return {
    platform: { type: PlatformType.Environment, value: Environment.Dev },
    apiKey: apiToken,
    headers: { "x-integration-id": "markupai-content-guardian-action" },
  };
}

/**
 * Run style check on a single file
 * Throws an error if the error is an auth or server issue.
 */
export async function analyzeFile(
  filePath: string,
  content: string,
  options: AnalysisOptions,
  config: Config,
): Promise<AnalysisResult | null> {
  try {
    core.info(`🔍 Running check on: ${filePath}`);

    const request: StyleAnalysisReq = {
      content,
      dialect: options.dialect,
      style_guide: options.styleGuide,
      documentNameWithExtension: getFileBasename(filePath),
      ...(options.tone ? { tone: options.tone } : {}),
    };

    const result = await styleCheck(request, config);

    return {
      filePath,
      result: result.original.scores,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    core.error(`Failed to run check on ${filePath}: ${String(error)}`);
    if (isRequestEndingError(error as Error)) {
      throw error;
    }
    return null;
  }
}

/**
 * Run analysis on multiple files using batch processing. Throws an error if the error is an auth or server issue.
 */
export async function analyzeFilesBatch(
  files: string[],
  options: AnalysisOptions,
  config: Config,
  readFileContent: (filePath: string) => Promise<string | null>,
): Promise<AnalysisResult[]> {
  if (files.length === 0) {
    return [];
  }

  core.info(`🚀 Starting batch analysis of ${files.length.toString()} files`);

  // Read all file contents first using optimized batch processing
  const fileContents = await processFileReading(files, readFileContent);

  if (fileContents.length === 0) {
    core.warning("No valid file contents found for analysis");
    return [];
  }

  // Create batch requests
  const requests: StyleAnalysisReq[] = fileContents.map(({ filePath, content }) => ({
    content,
    dialect: options.dialect,
    style_guide: options.styleGuide,
    documentNameWithExtension: getFileBasename(filePath),
    ...(options.tone ? { tone: options.tone } : {}),
  }));

  // Configure batch options with sensible defaults
  const batchOptions = {
    maxConcurrent: 100, // Limit concurrency to avoid overwhelming the API
    retryAttempts: 2,
    retryDelay: 1_000,
    timeout: 300_000, // 5 minutes
  };

  try {
    // Start batch processing
    const batchResponse = styleBatchCheckRequests(requests, config, batchOptions);

    // Monitor progress
    const progressInterval = setInterval(() => {
      const progress = batchResponse.progress;
      const completed = progress.completed;
      const failed = progress.failed;
      const total = progress.total;

      const { found } = checkForRequestEndingError(failed, progress.results);
      if (found) {
        batchResponse.cancel();
      }

      if (completed > 0 || failed > 0) {
        core.info(
          `📊 Batch progress: ${completed.toString()}/${total.toString()} completed, ${failed.toString()} failed`,
        );
      }
    }, 2_000); // Update every 2 seconds

    // Wait for completion
    const finalProgress = await batchResponse.promise;

    // Clear progress monitoring
    clearInterval(progressInterval);

    const { found, error } = checkForRequestEndingError(
      finalProgress.failed,
      finalProgress.results,
    );
    if (found) {
      throw error instanceof Error ? error : new Error(String(error));
    }

    // Process results
    const results: AnalysisResult[] = [];
    for (const [index, batchResult] of finalProgress.results.entries()) {
      if (batchResult.status === "completed" && batchResult.result) {
        results.push({
          filePath: fileContents[index].filePath,
          result: batchResult.result.original.scores,
          timestamp: new Date().toISOString(),
        });
      } else if (batchResult.status === "failed") {
        core.error(
          `Failed to analyze ${fileContents[index].filePath}: ${
            batchResult.error?.message || "Unknown error"
          }`,
        );
      }
    }

    core.info(
      `✅ Batch analysis completed: ${results.length.toString()}/${fileContents.length.toString()} files processed successfully`,
    );
    return results;
  } catch (error) {
    core.error(`Batch analysis failed: ${String(error)}`);
    if (isRequestEndingError(error as Error)) {
      throw error;
    }
    return [];
  }
}

/**
 * Run analysis on multiple files
 *
 * Uses batch processing for multiple files and sequential processing for small batches. Throws an error if the error is an auth or server issue.
 */
export async function analyzeFiles(
  files: string[],
  options: AnalysisOptions,
  config: Config,
  readFileContent: (filePath: string) => Promise<string | null>,
): Promise<AnalysisResult[]> {
  // For small batches, use sequential processing
  if (files.length <= 3) {
    const results: AnalysisResult[] = [];

    // Process files sequentially to avoid overwhelming the API
    for (const filePath of files) {
      const content = await readFileContent(filePath);
      if (content) {
        const result = await analyzeFile(filePath, content, options, config);
        if (result) {
          results.push(result);
        }
      }
    }

    return results;
  }

  // For larger batches, use batch processing
  return analyzeFilesBatch(files, options, config, readFileContent);
}

/**
 * Get analysis summary statistics
 */
export function getAnalysisSummary(results: AnalysisResult[]): ScoreSummary {
  const summary = calculateScoreSummary(results);
  return {
    totalFiles: summary.totalFiles,
    averageQualityScore: summary.averageQualityScore,
    averageClarityScore: summary.averageClarityScore,
    averageToneScore: summary.averageToneScore,
    averageGrammarScore: summary.averageGrammarScore,
    averageConsistencyScore: summary.averageConsistencyScore,
    averageTerminologyScore: summary.averageTerminologyScore,
  };
}
