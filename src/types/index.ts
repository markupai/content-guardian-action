/**
 * Core type definitions for the GitHub Action
 */

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
  changes: FileChange[];
}

export interface FileChange {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

/** Markup AI agent / workflow types */

export type WorkflowStatus = "running" | "completed" | "failed" | "timed_out" | "cancelled";
export type IssueSeverity = "high" | "medium" | "low";
export type RiskLevel = "high" | "medium" | "low" | "none";
export type StyleAgentMode = "enabled" | "enabled_terminology" | "disabled";

export interface AgentRunRequest {
  text: string;
  document_name?: string;
  document_ref?: string;
  target_id?: string;
}

export interface AgentRunResponse {
  workflow_id: string;
  request_id?: string | null;
  status: WorkflowStatus;
  document_ref?: string | null;
  result?: StyleAgentResult | null;
  started_at: string;
  completed_at?: string | null;
  duration_seconds?: number | null;
}

export interface StyleAgentResult {
  issues?: StyleAgentIssue[];
  quality?: StyleScores | null;
  analysis?: StyleAnalysis | null;
  warnings?: unknown[];
}

export interface StyleAgentIssue {
  id?: string;
  agent?: string;
  confidence?: number;
  severity: IssueSeverity;
  explanation: string;
  position?: { start: number; end: number; text: string };
  category: string;
  suggestion?: string | null;
  suggestions?: string[];
  guideline_name?: string;
  context_surface?: string;
  read_only?: boolean;
}

export interface StyleScores {
  score: number;
  status?: string;
  scoresByGoal?: ScoreByGoal[];
}

export interface ScoreByGoal {
  id: string;
  displayName: string;
  score: number;
  count: number;
}

export interface StyleAnalysis {
  targetId?: string;
  targetDisplayName?: string;
  contentProfileId?: string;
  contentProfileDisplayName?: string;
  words?: number;
  sentences?: number;
  clarityIndex?: number;
  informalityIndex?: number;
  livelinessIndex?: number;
  fleschReadingEase?: number;
}

export interface OrganizationConfigResponse {
  is_acrolinx_classic: boolean;
  style_agent: StyleAgentMode;
  style_agent_numeric_scoring: boolean;
}

export interface StyleTarget {
  id: string;
  display_name: string;
  is_default: boolean;
  enabled: boolean;
}

/** Per-file analysis result surfaced to the rest of the action */

export interface AnalysisIssue {
  issue: StyleAgentIssue;
  line: number;
  column: number;
  lineText: string;
}

export interface IssueCounts {
  total: number;
  high: number;
  medium: number;
  low: number;
}

export interface AnalysisResult {
  filePath: string;
  workflowId: string;
  status: WorkflowStatus;
  documentRef?: string;
  scores: StyleScores | null;
  analysis: StyleAnalysis | null;
  issues: AnalysisIssue[];
  issueCounts: IssueCounts;
  timestamp: string;
}

export interface EventInfo {
  eventType: string;
  description: string;
  filesCount: number;
  additionalInfo?: Record<string, unknown>;
}

export interface FileDiscoveryStrategy {
  getFilesToAnalyze(): Promise<string[]>;
  getEventInfo(): EventInfo;
}

export interface ActionConfig {
  apiToken: string;
  githubToken: string;
  target: string;
  addCommitStatus: boolean;
  addReviewComments: boolean;
  strictMode: boolean;
}

export interface AnalysisOptions {
  targetId: string;
  targetDisplayName: string;
  numericScoringEnabled: boolean;
}
