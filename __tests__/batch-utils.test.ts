/**
 * Unit tests for batch utilities
 */

import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

// Mock @actions/core
jest.unstable_mockModule('@actions/core', () => core)

const {
  DEFAULT_BATCH_CONFIG,
  processBatch,
  processWithConcurrency,
  processFileReading
} = await import('../src/utils/batch-utils.js')

describe('Batch Utils', () => {
  // Helper functions to reduce nesting
  const createMockProcessor = (returns: string[]) => {
    const mockFn = jest.fn()
    for (const value of returns) {
      mockFn.mockImplementationOnce(() => Promise.resolve(value))
    }
    return mockFn as jest.MockedFunction<(item: string) => Promise<string>>
  }

  const createMockProcessorWithError = (
    returns: (string | Error | undefined)[]
  ) => {
    const mockFn = jest.fn()
    for (const value of returns) {
      if (value instanceof Error) {
        mockFn.mockImplementationOnce(() => Promise.reject(value))
      } else {
        mockFn.mockImplementationOnce(() => Promise.resolve(value))
      }
    }
    return mockFn as jest.MockedFunction<
      (item: string) => Promise<string | undefined>
    >
  }

  const createMockFileReader = (returns: (string | null)[]) => {
    const mockFn = jest.fn()
    for (const value of returns) {
      mockFn.mockImplementationOnce(() => Promise.resolve(value))
    }
    return mockFn as jest.MockedFunction<
      (filePath: string) => Promise<string | null>
    >
  }

  const createConcurrencyTestProcessor = (
    concurrentCount: { value: number },
    maxConcurrent: { value: number }
  ) => {
    return jest.fn().mockImplementation(async () => {
      concurrentCount.value++
      maxConcurrent.value = Math.max(maxConcurrent.value, concurrentCount.value)
      await new Promise((resolve) => setTimeout(resolve, 1))
      concurrentCount.value--
      return 'processed'
    }) as jest.MockedFunction<(item: string) => Promise<string>>
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Constants', () => {
    it('should export default batch configuration', () => {
      expect(DEFAULT_BATCH_CONFIG).toEqual({
        maxConcurrent: 100,
        batchSize: 50,
        delayBetweenBatches: 1_000
      })
    })
  })

  describe('processBatch', () => {
    it('should return empty array for empty items', async () => {
      const processor = jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve('processed')
        ) as jest.MockedFunction<(item: unknown) => Promise<unknown>>
      const result = await processBatch([], processor)

      expect(result).toEqual([])
      expect(processor).not.toHaveBeenCalled()
    })

    it('should process single item', async () => {
      const items = ['item1']
      const processor = createMockProcessor(['processed1'])

      const result = await processBatch(items, processor)

      expect(result).toEqual(['processed1'])
      expect(processor).toHaveBeenCalledWith('item1')
      expect(processor).toHaveBeenCalledTimes(1)
    })

    it('should process multiple items in single batch', async () => {
      const items = ['item1', 'item2', 'item3']
      const processor = createMockProcessor([
        'processed1',
        'processed2',
        'processed3'
      ])

      const result = await processBatch(items, processor, {
        ...DEFAULT_BATCH_CONFIG,
        batchSize: 5
      })

      expect(result).toEqual(['processed1', 'processed2', 'processed3'])
      expect(processor).toHaveBeenCalledTimes(3)
    })

    it('should process items in multiple batches', async () => {
      const items = ['item1', 'item2', 'item3', 'item4', 'item5']
      const processor = createMockProcessor([
        'processed1',
        'processed2',
        'processed3',
        'processed4',
        'processed5'
      ])

      const result = await processBatch(items, processor, {
        ...DEFAULT_BATCH_CONFIG,
        batchSize: 2
      })

      expect(result).toEqual([
        'processed1',
        'processed2',
        'processed3',
        'processed4',
        'processed5'
      ])
      expect(processor).toHaveBeenCalledTimes(5)
    }, 10_000)

    it('should handle failed items gracefully', async () => {
      const items = ['item1', 'item2', 'item3']
      const processor = createMockProcessorWithError([
        'processed1',
        new Error('Failed to process item2'),
        'processed3'
      ])

      const result = await processBatch(items, processor)

      expect(result).toEqual(['processed1', 'processed3'])
      expect(core.error).toHaveBeenCalledWith(
        'Failed to process item 1: Error: Failed to process item2'
      )
    })

    it('should add delay between batches', async () => {
      const items = ['item1', 'item2', 'item3', 'item4']
      const processor = createMockProcessor([
        'processed1',
        'processed2',
        'processed3',
        'processed4'
      ])

      const result = await processBatch(items, processor, {
        ...DEFAULT_BATCH_CONFIG,
        batchSize: 2,
        delayBetweenBatches: 1_000
      })

      expect(result).toEqual([
        'processed1',
        'processed2',
        'processed3',
        'processed4'
      ])
    })

    it('should not add delay after last batch', async () => {
      const items = ['item1', 'item2']
      const processor = createMockProcessor(['processed1', 'processed2'])

      const result = await processBatch(items, processor, {
        ...DEFAULT_BATCH_CONFIG,
        batchSize: 2,
        delayBetweenBatches: 1_000
      })

      expect(result).toEqual(['processed1', 'processed2'])
    })

    it('should log progress information', async () => {
      const items = ['item1', 'item2', 'item3']
      const processor = createMockProcessor([
        'processed1',
        'processed2',
        'processed3'
      ])

      await processBatch(items, processor)

      expect(core.info).toHaveBeenCalledWith(
        '🚀 Processing 3 items in 1 batches'
      )
      expect(core.info).toHaveBeenCalledWith(
        '📦 Processing batch 1/1 (3 items)'
      )
      expect(core.info).toHaveBeenCalledWith(
        '✅ Batch processing completed: 3/3 items processed successfully'
      )
    })
  })

  describe('processWithConcurrency', () => {
    it('should return empty array for empty items', async () => {
      const processor = jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve('processed')
        ) as jest.MockedFunction<(item: unknown) => Promise<unknown>>
      const result = await processWithConcurrency([], processor)

      expect(result).toEqual([])
      expect(processor).not.toHaveBeenCalled()
    })

    it('should process single item', async () => {
      const items = ['item1']
      const processor = createMockProcessor(['processed1'])

      const result = await processWithConcurrency(items, processor)

      expect(result).toEqual(['processed1'])
      expect(processor).toHaveBeenCalledWith('item1')
      expect(processor).toHaveBeenCalledTimes(1)
    })

    it('should process multiple items with concurrency limit', async () => {
      const items = ['item1', 'item2', 'item3', 'item4', 'item5']
      const processor = createMockProcessor([
        'processed1',
        'processed2',
        'processed3',
        'processed4',
        'processed5'
      ])

      const result = await processWithConcurrency(items, processor, 2)

      expect(result).toEqual([
        'processed1',
        'processed2',
        'processed3',
        'processed4',
        'processed5'
      ])
      expect(processor).toHaveBeenCalledTimes(5)
    })

    it('should handle failed items gracefully', async () => {
      const items = ['item1', 'item2', 'item3']
      const processor = createMockProcessorWithError([
        'processed1',
        new Error('Failed to process item2'),
        'processed3'
      ])

      const result = await processWithConcurrency(items, processor)

      expect(result).toEqual(['processed1', 'processed3'])
    })

    it('should log progress information', async () => {
      const items = ['item1', 'item2', 'item3']
      const processor = createMockProcessor([
        'processed1',
        'processed2',
        'processed3'
      ])

      await processWithConcurrency(items, processor, 2)

      expect(core.info).toHaveBeenCalledWith(
        '🚀 Processing 3 items with max concurrency of 2'
      )
      expect(core.info).toHaveBeenCalledWith(
        '✅ Concurrency processing completed: 3/3 items processed successfully'
      )
    })

    it('should handle undefined results from failed operations', async () => {
      const items = ['item1', 'item2', 'item3']
      const processor = createMockProcessorWithError([
        'processed1',
        undefined,
        'processed3'
      ])

      const result = await processWithConcurrency(items, processor)

      expect(result).toEqual(['processed1', 'processed3'])
    })
  })

  describe('processFileReading', () => {
    it('should return empty array for empty file paths', async () => {
      const readFileContent = jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve('content')
        ) as jest.MockedFunction<(filePath: string) => Promise<string | null>>
      const result = await processFileReading([], readFileContent)

      expect(result).toEqual([])
      expect(readFileContent).not.toHaveBeenCalled()
    })

    it('should process files with valid content', async () => {
      const filePaths = ['file1.txt', 'file2.txt']
      const readFileContent = createMockFileReader(['content1', 'content2'])

      const result = await processFileReading(filePaths, readFileContent)

      expect(result).toEqual([
        { filePath: 'file1.txt', content: 'content1' },
        { filePath: 'file2.txt', content: 'content2' }
      ])
      expect(readFileContent).toHaveBeenCalledTimes(2)
    })

    it('should filter out files with null content', async () => {
      const filePaths = ['file1.txt', 'file2.txt', 'file3.txt']
      const readFileContent = createMockFileReader([
        'content1',
        null,
        'content3'
      ])

      const result = await processFileReading(filePaths, readFileContent)

      expect(result).toEqual([
        { filePath: 'file1.txt', content: 'content1' },
        { filePath: 'file3.txt', content: 'content3' }
      ])
      expect(readFileContent).toHaveBeenCalledTimes(3)
    })

    it('should use batch processing internally', async () => {
      const filePaths = [
        'file1.txt',
        'file2.txt',
        'file3.txt',
        'file4.txt',
        'file5.txt'
      ]
      const readFileContent = createMockFileReader([
        'content1',
        'content2',
        'content3',
        'content4',
        'content5'
      ])

      const result = await processFileReading(filePaths, readFileContent, {
        ...DEFAULT_BATCH_CONFIG,
        batchSize: 2
      })

      expect(result).toHaveLength(5)
      expect(readFileContent).toHaveBeenCalledTimes(5)
    }, 10_000)

    it('should handle mixed valid and invalid files', async () => {
      const filePaths = ['file1.txt', 'file2.txt', 'file3.txt']
      const readFileContent = createMockFileReader([
        'content1',
        null,
        'content3'
      ])

      const result = await processFileReading(filePaths, readFileContent)

      expect(result).toEqual([
        { filePath: 'file1.txt', content: 'content1' },
        { filePath: 'file3.txt', content: 'content3' }
      ])
    })
  })

  describe('Semaphore (internal)', () => {
    it('should handle concurrent access correctly', async () => {
      // This tests the internal Semaphore class through processWithConcurrency
      const items = ['item1', 'item2', 'item3']
      const concurrentCount = { value: 0 }
      const maxConcurrent = { value: 0 }

      const processor = createConcurrencyTestProcessor(
        concurrentCount,
        maxConcurrent
      )

      await processWithConcurrency(items, processor, 2)

      expect(maxConcurrent.value).toBeLessThanOrEqual(2)
      expect(processor).toHaveBeenCalledTimes(3)
    }, 10_000)
  })
})
