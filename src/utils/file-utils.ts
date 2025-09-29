/**
 * File utility functions
 */

import * as core from '@actions/core'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { SUPPORTED_EXTENSIONS } from '../constants/index.js'

/**
 * Check if a file is supported for analysis
 */
export function isSupportedFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase()
  return SUPPORTED_EXTENSIONS.includes(
    ext as (typeof SUPPORTED_EXTENSIONS)[number]
  )
}

/**
 * Read file content safely with error handling
 */
export async function readFileContent(
  filePath: string
): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return content
  } catch (error) {
    core.warning(`Failed to read file ${filePath}: ${error}`)
    return null
  }
}

/**
 * Filter files to only include supported ones
 */
export function filterSupportedFiles(files: string[]): string[] {
  return files.filter(isSupportedFile)
}

/**
 * Get file extension in lowercase
 */
export function getFileExtension(filename: string): string {
  return path.extname(filename).toLowerCase()
}

/**
 * Get file basename
 */
export function getFileBasename(filePath: string): string {
  return path.basename(filePath)
}
