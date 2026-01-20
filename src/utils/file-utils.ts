/**
 * File utility functions
 */

import * as core from "@actions/core";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { SUPPORTED_EXTENSIONS } from "../constants/index.js";

/**
 * Check if a file is supported for analysis
 */
export function isSupportedFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number]);
}

/**
 * Read file content safely with error handling
 */
export async function readFileContent(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content;
  } catch (error) {
    core.warning(`Failed to read file ${filePath}: ${String(error)}`);
    return null;
  }
}

/**
 * Filter files to only include supported ones
 */
export function filterSupportedFiles(files: string[]): string[] {
  return files.filter(isSupportedFile);
}

/**
 * Get file extension in lowercase
 */
export function getFileExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

/**
 * Get file basename
 */
export function getFileBasename(filePath: string): string {
  return path.basename(filePath);
}

/**
 * Get 1-based line number for a character index in content.
 */
export function getLineNumberAtIndex(content: string, index: number): number {
  if (!content || index <= 0) {
    return 1;
  }

  const safeIndex = Math.min(index, content.length);
  let line = 1;
  for (let i = 0; i < safeIndex; i += 1) {
    if (content[i] === "\n") {
      line += 1;
    }
  }
  return line;
}

/**
 * Get line number, column, and line text for a character index.
 */
export function getLineContextAtIndex(
  content: string,
  index: number,
): { line: number; column: number; lineText: string } {
  if (!content) {
    return { line: 1, column: 0, lineText: "" };
  }

  const safeIndex = Math.min(Math.max(index, 0), content.length);
  const line = getLineNumberAtIndex(content, safeIndex);
  const lineStart = content.lastIndexOf("\n", safeIndex - 1) + 1;
  const lineEndRaw = content.indexOf("\n", safeIndex);
  const lineEnd = lineEndRaw === -1 ? content.length : lineEndRaw;
  const lineText = content.slice(lineStart, lineEnd);
  const column = safeIndex - lineStart;

  return { line, column, lineText };
}
