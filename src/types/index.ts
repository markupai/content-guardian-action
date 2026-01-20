/**
 * Core type definitions for the GitHub Action
 */

/**
 * Interface for commit information
 */
export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
  changes: FileChange[];
}

/**
 * Interface for file changes
 */
export interface FileChange {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

import type { Issue, IssueWithSuggestion, StyleScores } from "@markupai/toolkit";

/**
 * Interface for analysis result
 */
export interface AnalysisResult {
  filePath: string;
  result: StyleScores;
  issues: AnalysisIssue[];
  timestamp: string;
}

/**
 * Interface for analysis issues with file line context
 */
export interface AnalysisIssue {
  issue: Issue | IssueWithSuggestion;
  line: number;
}

/**
 * Interface for event information
 */
export interface EventInfo {
  eventType: string;
  description: string;
  filesCount: number;
  additionalInfo?: Record<string, unknown>;
}

/**
 * Interface for file discovery strategy
 */
export interface FileDiscoveryStrategy {
  getFilesToAnalyze(): Promise<string[]>;
  getEventInfo(): EventInfo;
}

/**
 * Configuration for the action
 */
export interface ActionConfig {
  apiToken: string;
  dialect: string;
  tone?: string;
  styleGuide: string;
  githubToken: string;
  addCommitStatus: boolean;
  strictMode: boolean;
}

/**
 * Analysis options
 */
export interface AnalysisOptions {
  dialect: string;
  tone?: string;
  styleGuide: string;
}

// Re-export types from SDK
export type { StyleAnalysisReq, Config } from "@markupai/toolkit";
