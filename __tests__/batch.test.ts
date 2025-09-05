import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

// Mock @actions/core
jest.unstable_mockModule('@actions/core', () => core)

jest.unstable_mockModule('@markupai/toolkit', () => ({
  styleCheck: jest.fn(),
  styleBatchCheckRequests: jest.fn(),
  Config: jest.fn()
}))

// Import the module after mocking
const { analyzeFiles, analyzeFilesBatch } = await import(
  '../src/services/api-service.js'
)
import type { AnalysisOptions } from '../src/types/index.js'
import { PlatformType, Config, Status } from '@markupai/toolkit'
import { buildScores } from './test-helpers/scores.js'

describe('Markup AI Service Batch Functionality', () => {
  let mockConfig: Config
  let mockOptions: AnalysisOptions
  let mockReadFileContent: (filePath: string) => Promise<string | null>

  beforeEach(() => {
    jest.clearAllMocks()

    mockConfig = {
      apiKey: 'test-api-key',
      platform: { type: PlatformType.Url, value: 'https://test.markup.ai' }
    }

    mockOptions = {
      dialect: 'en-US',
      tone: 'formal',
      styleGuide: 'microsoft'
    }

    mockReadFileContent = jest.fn().mockImplementation((filePath: unknown) => {
      return Promise.resolve(`Test content for ${filePath as string}`)
    }) as jest.MockedFunction<(filePath: string) => Promise<string | null>>
  })

  describe('analyzeFilesBatch', () => {
    it('should return empty array for empty files list', async () => {
      const result = await analyzeFilesBatch(
        [],
        mockOptions,
        mockConfig,
        mockReadFileContent
      )

      expect(result).toEqual([])
    })

    it('should handle files with no valid content', async () => {
      const mockReadFileContentEmpty = jest
        .fn()
        .mockImplementation(() => Promise.resolve(null)) as jest.MockedFunction<
        (filePath: string) => Promise<string | null>
      >

      const result = await analyzeFilesBatch(
        ['file1.txt', 'file2.txt'],
        mockOptions,
        mockConfig,
        mockReadFileContentEmpty
      )

      expect(result).toEqual([])
    })

    it('should process multiple files using batch API', async () => {
      const { styleBatchCheckRequests } = await import('@markupai/toolkit')
      const mockBatchResponse = {
        progress: {
          total: 2,
          completed: 2,
          failed: 0,
          inProgress: 0,
          pending: 0,
          results: [
            {
              index: 0,
              status: 'completed' as const,
              request: {
                content: 'Test content for file1.txt',
                dialect: 'en-US',
                tone: 'formal',
                style_guide: 'microsoft',
                documentName: 'file1.txt'
              },
              result: {
                workflow: {
                  id: 'test-workflow-1',
                  type: 'checks',
                  api_version: '1.0.0',
                  generated_at: '2025-01-15T14:22:33Z',
                  status: Status.Completed,
                  webhook_response: {
                    url: 'https://api.example.com/webhook',
                    status_code: 200
                  }
                },
                config: {
                  dialect: 'en-US',
                  style_guide: {
                    style_guide_type: 'microsoft',
                    style_guide_id: 'test-style-guide-1'
                  },
                  tone: 'formal'
                },
                original: {
                  issues: [],
                  scores: buildScores(85, 90, 88)
                }
              }
            },
            {
              index: 1,
              status: 'completed' as const,
              request: {
                content: 'Test content for file2.txt',
                dialect: 'en-US',
                tone: 'formal',
                style_guide: 'microsoft',
                documentName: 'file2.txt'
              },
              result: {
                workflow: {
                  id: 'test-workflow-2',
                  type: 'checks',
                  api_version: '1.0.0',
                  generated_at: '2025-01-15T14:22:33Z',
                  status: Status.Completed,
                  webhook_response: {
                    url: 'https://api.example.com/webhook',
                    status_code: 200
                  }
                },
                config: {
                  dialect: 'en-US',
                  style_guide: {
                    style_guide_type: 'microsoft',
                    style_guide_id: 'test-style-guide-2'
                  },
                  tone: 'formal'
                },
                original: {
                  issues: [],
                  scores: buildScores(92, 87, 91)
                }
              }
            }
          ],
          startTime: Date.now()
        },
        promise: Promise.resolve({
          total: 2,
          completed: 2,
          failed: 0,
          inProgress: 0,
          pending: 0,
          results: [
            {
              index: 0,
              status: 'completed' as const,
              request: {
                content: 'Test content for file1.txt',
                dialect: 'en-US',
                tone: 'formal',
                style_guide: 'microsoft',
                documentName: 'file1.txt'
              },
              result: {
                workflow: {
                  id: 'test-workflow-1',
                  type: 'checks',
                  api_version: '1.0.0',
                  generated_at: '2025-01-15T14:22:33Z',
                  status: Status.Completed,
                  webhook_response: {
                    url: 'https://api.example.com/webhook',
                    status_code: 200
                  }
                },
                config: {
                  dialect: 'en-US',
                  style_guide: {
                    style_guide_type: 'microsoft',
                    style_guide_id: 'test-style-guide-1'
                  },
                  tone: 'formal'
                },
                original: {
                  issues: [],
                  scores: buildScores(85, 90, 88)
                }
              }
            },
            {
              index: 1,
              status: 'completed' as const,
              request: {
                content: 'Test content for file2.txt',
                dialect: 'en-US',
                tone: 'formal',
                style_guide: 'microsoft',
                documentName: 'file2.txt'
              },
              result: {
                workflow: {
                  id: 'test-workflow-2',
                  type: 'checks',
                  api_version: '1.0.0',
                  generated_at: '2025-01-15T14:22:33Z',
                  status: Status.Completed,
                  webhook_response: {
                    url: 'https://api.example.com/webhook',
                    status_code: 200
                  }
                },
                config: {
                  dialect: 'en-US',
                  style_guide: {
                    style_guide_type: 'microsoft',
                    style_guide_id: 'test-style-guide-2'
                  },
                  tone: 'formal'
                },
                original: {
                  issues: [],
                  scores: buildScores(92, 87, 91)
                }
              }
            }
          ],
          startTime: Date.now()
        }),
        cancel: jest.fn()
      }

      jest.mocked(styleBatchCheckRequests).mockReturnValue(mockBatchResponse)

      const result = await analyzeFilesBatch(
        ['file1.txt', 'file2.txt'],
        mockOptions,
        mockConfig,
        mockReadFileContent
      )

      expect(styleBatchCheckRequests).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: 'Test content for file1.txt',
            dialect: 'en-US',
            tone: 'formal',
            style_guide: 'microsoft',
            documentName: 'file1.txt'
          }),
          expect.objectContaining({
            content: 'Test content for file2.txt',
            dialect: 'en-US',
            tone: 'formal',
            style_guide: 'microsoft',
            documentName: 'file2.txt'
          })
        ]),
        mockConfig,
        expect.objectContaining({
          maxConcurrent: 100,
          retryAttempts: 2,
          retryDelay: 1000,
          timeout: 300000
        })
      )

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(
        expect.objectContaining({
          filePath: 'file1.txt',
          result: expect.objectContaining({
            quality: expect.objectContaining({ score: 85 }),
            analysis: expect.objectContaining({
              clarity: expect.objectContaining({ score: 90 }),
              tone: expect.objectContaining({ score: 88 })
            })
          }),
          timestamp: expect.any(String)
        })
      )
      expect(result[1]).toEqual(
        expect.objectContaining({
          filePath: 'file2.txt',
          result: expect.objectContaining({
            quality: expect.objectContaining({ score: 92 }),
            analysis: expect.objectContaining({
              clarity: expect.objectContaining({ score: 87 }),
              tone: expect.objectContaining({ score: 91 })
            })
          }),
          timestamp: expect.any(String)
        })
      )
    })

    it('should handle failed batch requests', async () => {
      const { styleBatchCheckRequests } = await import('@markupai/toolkit')
      const mockBatchResponse = {
        progress: {
          total: 2,
          completed: 1,
          failed: 1,
          inProgress: 0,
          pending: 0,
          results: [
            {
              index: 0,
              status: 'completed' as const,
              request: {
                content: 'Test content for file1.txt',
                dialect: 'en-US',
                tone: 'formal',
                style_guide: 'microsoft',
                documentName: 'file1.txt'
              },
              result: {
                workflow: {
                  id: 'test-workflow-1',
                  type: 'checks',
                  api_version: '1.0.0',
                  generated_at: '2025-01-15T14:22:33Z',
                  status: Status.Completed,
                  webhook_response: {
                    url: 'https://api.example.com/webhook',
                    status_code: 200
                  }
                },
                config: {
                  dialect: 'en-US',
                  style_guide: {
                    style_guide_type: 'microsoft',
                    style_guide_id: 'test-style-guide-1'
                  },
                  tone: 'formal'
                },
                original: {
                  issues: [],
                  scores: {
                    quality: {
                      score: 85,
                      grammar: { score: 85, issues: 10 },
                      alignment: { score: 85, issues: 10 },
                      terminology: { score: 85, issues: 10 }
                    },
                    analysis: {
                      clarity: {
                        score: 90,
                        word_count: 100,
                        sentence_count: 10,
                        average_sentence_length: 10,
                        flesch_reading_ease: 10,
                        vocabulary_complexity: 10,
                        sentence_complexity: 10
                      },
                      tone: {
                        score: 88,
                        informality: 10,
                        liveliness: 10,
                        informality_alignment: 10,
                        liveliness_alignment: 10
                      }
                    }
                  }
                }
              }
            },
            {
              index: 1,
              status: 'failed' as const,
              request: {
                content: 'Test content for file2.txt',
                dialect: 'en-US',
                tone: 'formal',
                style_guide: 'microsoft',
                documentName: 'file2.txt'
              },
              error: new Error('API Error')
            }
          ],
          startTime: Date.now()
        },
        promise: Promise.resolve({
          total: 2,
          completed: 1,
          failed: 1,
          inProgress: 0,
          pending: 0,
          results: [
            {
              index: 0,
              status: 'completed' as const,
              request: {
                content: 'Test content for file1.txt',
                dialect: 'en-US',
                tone: 'formal',
                style_guide: 'microsoft',
                documentName: 'file1.txt'
              },
              result: {
                workflow: {
                  id: 'test-workflow-1',
                  type: 'checks',
                  api_version: '1.0.0',
                  generated_at: '2025-01-15T14:22:33Z',
                  status: Status.Completed,
                  webhook_response: {
                    url: 'https://api.example.com/webhook',
                    status_code: 200
                  }
                },
                config: {
                  dialect: 'en-US',
                  style_guide: {
                    style_guide_type: 'microsoft',
                    style_guide_id: 'test-style-guide-1'
                  },
                  tone: 'formal'
                },
                original: {
                  issues: [],
                  scores: {
                    quality: {
                      score: 85,
                      grammar: { score: 85, issues: 10 },
                      alignment: { score: 85, issues: 10 },
                      terminology: { score: 85, issues: 10 }
                    },
                    analysis: {
                      clarity: {
                        score: 90,
                        word_count: 100,
                        sentence_count: 10,
                        average_sentence_length: 10,
                        flesch_reading_ease: 10,
                        vocabulary_complexity: 10,
                        sentence_complexity: 10
                      },
                      tone: {
                        score: 88,
                        informality: 10,
                        liveliness: 10,
                        informality_alignment: 10,
                        liveliness_alignment: 10
                      }
                    }
                  }
                }
              }
            },
            {
              index: 1,
              status: 'failed' as const,
              request: {
                content: 'Test content for file2.txt',
                dialect: 'en-US',
                tone: 'formal',
                style_guide: 'microsoft',
                documentName: 'file2.txt'
              },
              error: new Error('API Error')
            }
          ],
          startTime: Date.now()
        }),
        cancel: jest.fn()
      }

      jest.mocked(styleBatchCheckRequests).mockReturnValue(mockBatchResponse)

      const result = await analyzeFilesBatch(
        ['file1.txt', 'file2.txt'],
        mockOptions,
        mockConfig,
        mockReadFileContent
      )

      expect(result).toHaveLength(1)
      expect(result[0].filePath).toBe('file1.txt')
    })

    it('should handle batch processing errors', async () => {
      const { styleBatchCheckRequests } = await import('@markupai/toolkit')
      jest.mocked(styleBatchCheckRequests).mockImplementation(() => {
        throw new Error('Batch processing failed')
      })

      const result = await analyzeFilesBatch(
        ['file1.txt', 'file2.txt'],
        mockOptions,
        mockConfig,
        mockReadFileContent
      )

      expect(result).toEqual([])
    })
  })

  describe('analyzeFiles with batch processing', () => {
    it('should use sequential processing for small batches (≤3 files)', async () => {
      const { styleCheck } = await import('@markupai/toolkit')
      jest.mocked(styleCheck).mockResolvedValue({
        workflow: {
          id: 'test-workflow-1',
          type: 'checks',
          api_version: '1.0.0',
          generated_at: '2025-01-15T14:22:33Z',
          status: Status.Completed,
          webhook_response: {
            url: 'https://api.example.com/webhook',
            status_code: 200
          }
        },
        config: {
          dialect: 'en-US',
          style_guide: {
            style_guide_type: 'microsoft',
            style_guide_id: 'test-style-guide-1'
          },
          tone: 'formal'
        },
        original: {
          issues: [],
          scores: {
            quality: {
              score: 85,
              grammar: { score: 85, issues: 10 },
              alignment: { score: 85, issues: 10 },
              terminology: { score: 85, issues: 10 }
            },
            analysis: {
              clarity: {
                score: 90,
                word_count: 100,
                sentence_count: 10,
                average_sentence_length: 10,
                flesch_reading_ease: 10,
                vocabulary_complexity: 10,
                sentence_complexity: 10
              },
              tone: {
                score: 88,
                informality: 10,
                liveliness: 10,
                informality_alignment: 10,
                liveliness_alignment: 10
              }
            }
          }
        }
      })

      const result = await analyzeFiles(
        ['file1.txt', 'file2.txt'],
        mockOptions,
        mockConfig,
        mockReadFileContent
      )

      expect(styleCheck).toHaveBeenCalledTimes(2)
      expect(result).toHaveLength(2)
    })

    it('should use batch processing for larger batches (>3 files)', async () => {
      const { styleBatchCheckRequests } = await import('@markupai/toolkit')
      const mockBatchResponse = {
        progress: {
          total: 4,
          completed: 4,
          failed: 0,
          inProgress: 0,
          pending: 0,
          results: [
            {
              index: 0,
              status: 'completed' as const,
              request: {
                content: 'Test content for file1.txt',
                dialect: 'en-US',
                tone: 'formal',
                style_guide: 'microsoft',
                documentName: 'file1.txt'
              },
              result: {
                workflow: {
                  id: 'test-workflow-1',
                  type: 'checks',
                  api_version: '1.0.0',
                  generated_at: '2025-01-15T14:22:33Z',
                  status: Status.Completed,
                  webhook_response: {
                    url: 'https://api.example.com/webhook',
                    status_code: 200
                  }
                },
                config: {
                  dialect: 'en-US',
                  style_guide: {
                    style_guide_type: 'microsoft',
                    style_guide_id: 'test-style-guide-1'
                  },
                  tone: 'formal'
                },
                original: {
                  issues: [],
                  scores: {
                    quality: {
                      score: 85,
                      grammar: { score: 85, issues: 10 },
                      alignment: { score: 85, issues: 10 },
                      terminology: { score: 85, issues: 10 }
                    },
                    analysis: {
                      clarity: {
                        score: 90,
                        word_count: 100,
                        sentence_count: 10,
                        average_sentence_length: 10,
                        flesch_reading_ease: 10,
                        vocabulary_complexity: 10,
                        sentence_complexity: 10
                      },
                      tone: {
                        score: 88,
                        informality: 10,
                        liveliness: 10,
                        informality_alignment: 10,
                        liveliness_alignment: 10
                      }
                    }
                  }
                }
              }
            },
            {
              index: 1,
              status: 'completed' as const,
              request: {
                content: 'Test content for file2.txt',
                dialect: 'en-US',
                tone: 'formal',
                style_guide: 'microsoft',
                documentName: 'file2.txt'
              },
              result: {
                workflow: {
                  id: 'test-workflow-2',
                  type: 'checks',
                  api_version: '1.0.0',
                  generated_at: '2025-01-15T14:22:33Z',
                  status: Status.Completed,
                  webhook_response: {
                    url: 'https://api.example.com/webhook',
                    status_code: 200
                  }
                },
                config: {
                  dialect: 'en-US',
                  style_guide: {
                    style_guide_type: 'microsoft',
                    style_guide_id: 'test-style-guide-2'
                  },
                  tone: 'formal'
                },
                original: {
                  issues: [],
                  scores: {
                    quality: {
                      score: 92,
                      grammar: { score: 92, issues: 10 },
                      alignment: { score: 92, issues: 10 },
                      terminology: { score: 92, issues: 10 }
                    },
                    analysis: {
                      clarity: {
                        score: 87,
                        word_count: 100,
                        sentence_count: 10,
                        average_sentence_length: 10,
                        flesch_reading_ease: 10,
                        vocabulary_complexity: 10,
                        sentence_complexity: 10
                      },
                      tone: {
                        score: 91,
                        informality: 10,
                        liveliness: 10,
                        informality_alignment: 10,
                        liveliness_alignment: 10
                      }
                    }
                  }
                }
              }
            },
            {
              index: 2,
              status: 'completed' as const,
              request: {
                content: 'Test content for file3.txt',
                dialect: 'en-US',
                tone: 'formal',
                style_guide: 'microsoft',
                documentName: 'file3.txt'
              },
              result: {
                workflow: {
                  id: 'test-workflow-3',
                  type: 'checks',
                  api_version: '1.0.0',
                  generated_at: '2025-01-15T14:22:33Z',
                  status: Status.Completed,
                  webhook_response: {
                    url: 'https://api.example.com/webhook',
                    status_code: 200
                  }
                },
                config: {
                  dialect: 'en-US',
                  style_guide: {
                    style_guide_type: 'microsoft',
                    style_guide_id: 'test-style-guide-3'
                  },
                  tone: 'formal'
                },
                original: {
                  issues: [],
                  scores: {
                    quality: {
                      score: 89,
                      grammar: { score: 89, issues: 10 },
                      alignment: { score: 89, issues: 10 },
                      terminology: { score: 89, issues: 10 }
                    },
                    analysis: {
                      clarity: {
                        score: 93,
                        word_count: 100,
                        sentence_count: 10,
                        average_sentence_length: 10,
                        flesch_reading_ease: 10,
                        vocabulary_complexity: 10,
                        sentence_complexity: 10
                      },
                      tone: {
                        score: 86,
                        informality: 10,
                        liveliness: 10,
                        informality_alignment: 10,
                        liveliness_alignment: 10
                      }
                    }
                  }
                }
              }
            },
            {
              index: 3,
              status: 'completed' as const,
              request: {
                content: 'Test content for file4.txt',
                dialect: 'en-US',
                tone: 'formal',
                style_guide: 'microsoft',
                documentName: 'file4.txt'
              },
              result: {
                workflow: {
                  id: 'test-workflow-4',
                  type: 'checks',
                  api_version: '1.0.0',
                  generated_at: '2025-01-15T14:22:33Z',
                  status: Status.Completed,
                  webhook_response: {
                    url: 'https://api.example.com/webhook',
                    status_code: 200
                  }
                },
                config: {
                  dialect: 'en-US',
                  style_guide: {
                    style_guide_type: 'microsoft',
                    style_guide_id: 'test-style-guide-4'
                  },
                  tone: 'formal'
                },
                original: {
                  issues: [],
                  scores: {
                    quality: {
                      score: 94,
                      grammar: { score: 94, issues: 10 },
                      alignment: { score: 94, issues: 10 },
                      terminology: { score: 94, issues: 10 }
                    },
                    analysis: {
                      clarity: {
                        score: 88,
                        word_count: 100,
                        sentence_count: 10,
                        average_sentence_length: 10,
                        flesch_reading_ease: 10,
                        vocabulary_complexity: 10,
                        sentence_complexity: 10
                      },
                      tone: {
                        score: 92,
                        informality: 10,
                        liveliness: 10,
                        informality_alignment: 10,
                        liveliness_alignment: 10
                      }
                    }
                  }
                }
              }
            }
          ],
          startTime: Date.now()
        },
        promise: Promise.resolve({
          total: 4,
          completed: 4,
          failed: 0,
          inProgress: 0,
          pending: 0,
          results: [
            {
              index: 0,
              status: 'completed' as const,
              request: {
                content: 'Test content for file1.txt',
                dialect: 'en-US',
                tone: 'formal',
                style_guide: 'microsoft',
                documentName: 'file1.txt'
              },
              result: {
                workflow: {
                  id: 'test-workflow-1',
                  type: 'checks',
                  api_version: '1.0.0',
                  generated_at: '2025-01-15T14:22:33Z',
                  status: Status.Completed,
                  webhook_response: {
                    url: 'https://api.example.com/webhook',
                    status_code: 200
                  }
                },
                config: {
                  dialect: 'en-US',
                  style_guide: {
                    style_guide_type: 'microsoft',
                    style_guide_id: 'test-style-guide-1'
                  },
                  tone: 'formal'
                },
                original: {
                  issues: [],
                  scores: {
                    quality: {
                      score: 85,
                      grammar: { score: 85, issues: 10 },
                      alignment: { score: 85, issues: 10 },
                      terminology: { score: 85, issues: 10 }
                    },
                    analysis: {
                      clarity: {
                        score: 90,
                        word_count: 100,
                        sentence_count: 10,
                        average_sentence_length: 10,
                        flesch_reading_ease: 10,
                        vocabulary_complexity: 10,
                        sentence_complexity: 10
                      },
                      tone: {
                        score: 88,
                        informality: 10,
                        liveliness: 10,
                        informality_alignment: 10,
                        liveliness_alignment: 10
                      }
                    }
                  }
                }
              }
            },
            {
              index: 1,
              status: 'completed' as const,
              request: {
                content: 'Test content for file2.txt',
                dialect: 'en-US',
                tone: 'formal',
                style_guide: 'microsoft',
                documentName: 'file2.txt'
              },
              result: {
                workflow: {
                  id: 'test-workflow-2',
                  type: 'checks',
                  api_version: '1.0.0',
                  generated_at: '2025-01-15T14:22:33Z',
                  status: Status.Completed,
                  webhook_response: {
                    url: 'https://api.example.com/webhook',
                    status_code: 200
                  }
                },
                config: {
                  dialect: 'en-US',
                  style_guide: {
                    style_guide_type: 'microsoft',
                    style_guide_id: 'test-style-guide-2'
                  },
                  tone: 'formal'
                },
                original: {
                  issues: [],
                  scores: {
                    quality: {
                      score: 92,
                      grammar: { score: 92, issues: 10 },
                      alignment: { score: 92, issues: 10 },
                      terminology: { score: 92, issues: 10 }
                    },
                    analysis: {
                      clarity: {
                        score: 87,
                        word_count: 100,
                        sentence_count: 10,
                        average_sentence_length: 10,
                        flesch_reading_ease: 10,
                        vocabulary_complexity: 10,
                        sentence_complexity: 10
                      },
                      tone: {
                        score: 91,
                        informality: 10,
                        liveliness: 10,
                        informality_alignment: 10,
                        liveliness_alignment: 10
                      }
                    }
                  }
                }
              }
            },
            {
              index: 2,
              status: 'completed' as const,
              request: {
                content: 'Test content for file3.txt',
                dialect: 'en-US',
                tone: 'formal',
                style_guide: 'microsoft',
                documentName: 'file3.txt'
              },
              result: {
                workflow: {
                  id: 'test-workflow-3',
                  type: 'checks',
                  api_version: '1.0.0',
                  generated_at: '2025-01-15T14:22:33Z',
                  status: Status.Completed,
                  webhook_response: {
                    url: 'https://api.example.com/webhook',
                    status_code: 200
                  }
                },
                config: {
                  dialect: 'en-US',
                  style_guide: {
                    style_guide_type: 'microsoft',
                    style_guide_id: 'test-style-guide-3'
                  },
                  tone: 'formal'
                },
                original: {
                  issues: [],
                  scores: {
                    quality: {
                      score: 89,
                      grammar: { score: 89, issues: 10 },
                      alignment: { score: 89, issues: 10 },
                      terminology: { score: 89, issues: 10 }
                    },
                    analysis: {
                      clarity: {
                        score: 93,
                        word_count: 100,
                        sentence_count: 10,
                        average_sentence_length: 10,
                        flesch_reading_ease: 10,
                        vocabulary_complexity: 10,
                        sentence_complexity: 10
                      },
                      tone: {
                        score: 86,
                        informality: 10,
                        liveliness: 10,
                        informality_alignment: 10,
                        liveliness_alignment: 10
                      }
                    }
                  }
                }
              }
            },
            {
              index: 3,
              status: 'completed' as const,
              request: {
                content: 'Test content for file4.txt',
                dialect: 'en-US',
                tone: 'formal',
                style_guide: 'microsoft',
                documentName: 'file4.txt'
              },
              result: {
                workflow: {
                  id: 'test-workflow-4',
                  type: 'checks',
                  api_version: '1.0.0',
                  generated_at: '2025-01-15T14:22:33Z',
                  status: Status.Completed,
                  webhook_response: {
                    url: 'https://api.example.com/webhook',
                    status_code: 200
                  }
                },
                config: {
                  dialect: 'en-US',
                  style_guide: {
                    style_guide_type: 'microsoft',
                    style_guide_id: 'test-style-guide-4'
                  },
                  tone: 'formal'
                },
                original: {
                  issues: [],
                  scores: {
                    quality: {
                      score: 94,
                      grammar: { score: 94, issues: 10 },
                      alignment: { score: 94, issues: 10 },
                      terminology: { score: 94, issues: 10 }
                    },
                    analysis: {
                      clarity: {
                        score: 88,
                        word_count: 100,
                        sentence_count: 10,
                        average_sentence_length: 10,
                        flesch_reading_ease: 10,
                        vocabulary_complexity: 10,
                        sentence_complexity: 10
                      },
                      tone: {
                        score: 92,
                        informality: 10,
                        liveliness: 10,
                        informality_alignment: 10,
                        liveliness_alignment: 10
                      }
                    }
                  }
                }
              }
            }
          ],
          startTime: Date.now()
        }),
        cancel: jest.fn()
      }

      jest.mocked(styleBatchCheckRequests).mockReturnValue(mockBatchResponse)

      const result = await analyzeFiles(
        ['file1.txt', 'file2.txt', 'file3.txt', 'file4.txt'],
        mockOptions,
        mockConfig,
        mockReadFileContent
      )

      expect(styleBatchCheckRequests).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(4)
    })
  })
})
