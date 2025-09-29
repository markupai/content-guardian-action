/**
 * Batch processing utilities for optimized operations
 */

import * as core from '@actions/core'

/**
 * Batch processing configuration
 */
export interface BatchConfig {
  maxConcurrent: number
  batchSize: number
  delayBetweenBatches: number
}

/**
 * Default batch configuration
 */
export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  maxConcurrent: 100,
  batchSize: 50,
  delayBetweenBatches: 1000
}

/**
 * Process items in batches with concurrency control
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  config: BatchConfig = DEFAULT_BATCH_CONFIG
): Promise<R[]> {
  if (items.length === 0) {
    return []
  }

  const results: R[] = []
  const batches = chunkArray(items, config.batchSize)

  core.info(`🚀 Processing ${items.length} items in ${batches.length} batches`)

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    core.info(
      `📦 Processing batch ${i + 1}/${batches.length} (${batch.length} items)`
    )

    const batchResults = await Promise.allSettled(
      batch.map((item) => processor(item))
    )

    // Process results
    for (const [index, result] of batchResults.entries()) {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        core.error(
          `Failed to process item ${i * config.batchSize + index}: ${result.reason}`
        )
      }
    }

    // Add delay between batches to avoid overwhelming APIs
    if (i < batches.length - 1 && config.delayBetweenBatches > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, config.delayBetweenBatches)
      )
    }
  }

  core.info(
    `✅ Batch processing completed: ${results.length}/${items.length} items processed successfully`
  )
  return results
}

/**
 * Process items with concurrency limit
 */
export async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  maxConcurrent: number = DEFAULT_BATCH_CONFIG.maxConcurrent
): Promise<R[]> {
  if (items.length === 0) {
    return []
  }

  const results: R[] = []
  const semaphore = new Semaphore(maxConcurrent)

  core.info(
    `🚀 Processing ${items.length} items with max concurrency of ${maxConcurrent}`
  )

  const promises = items.map(async (item, index) => {
    await semaphore.acquire()
    try {
      const result = await processor(item)
      results[index] = result
      return result
    } finally {
      semaphore.release()
    }
  })

  await Promise.allSettled(promises)

  const successfulResults = results.filter((result) => result !== undefined)
  core.info(
    `✅ Concurrency processing completed: ${successfulResults.length}/${items.length} items processed successfully`
  )

  return successfulResults
}

/**
 * Simple semaphore implementation for concurrency control
 */
class Semaphore {
  private permits: number
  private readonly waiting: Array<() => void> = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return
    }

    return new Promise<void>((resolve) => {
      this.waiting.push(resolve)
    })
  }

  release(): void {
    this.permits++
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()
      if (next) {
        this.permits--
        next()
      }
    }
  }
}

/**
 * Split array into chunks
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

/**
 * Process file reading in optimized batches
 */
export async function processFileReading(
  filePaths: string[],
  readFileContent: (filePath: string) => Promise<string | null>,
  config: BatchConfig = DEFAULT_BATCH_CONFIG
): Promise<Array<{ filePath: string; content: string }>> {
  const fileContents = await processBatch(
    filePaths,
    async (filePath) => {
      const content = await readFileContent(filePath)
      return content ? { filePath, content } : null
    },
    config
  )

  return fileContents.filter(
    (item): item is { filePath: string; content: string } => item !== null
  )
}
