/**
 * Unit tests for type guard utilities
 */

// import { jest } from '@jest/globals' // Not used in tests
import {
  isString,
  isNumber,
  isBoolean,
  isObject,
  isArray,
  isFunction,
  isNullOrUndefined,
  isNotNullOrUndefined,
  hasProperty,
  hasRequiredProperties,
  isValidSHA,
  isValidQualityScore,
  isValidFilePath,
  isGitHubAPIError,
  isApiError,
  safeGet,
  safeArrayGet
} from '../src/utils/type-guards.js'

describe('Type Guards', () => {
  // Helper functions to reduce nesting
  const createInvalidArray = (value: unknown) => value as unknown as unknown[]
  const createInvalidNumber = (value: unknown) => value as unknown as number

  // Test functions for isFunction tests
  const testArrowFunction = () => {
    /* empty */
  }
  const testRegularFunction = function () {
    /* empty */
  }
  const testAsyncFunction = async () => {
    /* empty */
  }

  describe('Basic Type Guards', () => {
    describe('isString', () => {
      it('should return true for strings', () => {
        expect(isString('hello')).toBe(true)
        expect(isString('')).toBe(true)
        expect(isString('123')).toBe(true)
      })

      it('should return false for non-strings', () => {
        expect(isString(123)).toBe(false)
        expect(isString(true)).toBe(false)
        expect(isString(null)).toBe(false)
        expect(isString(undefined)).toBe(false)
        expect(isString({})).toBe(false)
        expect(isString([])).toBe(false)
      })
    })

    describe('isNumber', () => {
      it('should return true for valid numbers', () => {
        expect(isNumber(123)).toBe(true)
        expect(isNumber(0)).toBe(true)
        expect(isNumber(-123)).toBe(true)
        expect(isNumber(3.14)).toBe(true)
      })

      it('should return false for invalid numbers', () => {
        expect(isNumber(Number.NaN)).toBe(false)
        expect(isNumber(Infinity)).toBe(true) // Infinity is a valid number in JavaScript
        expect(isNumber(-Infinity)).toBe(true) // -Infinity is a valid number in JavaScript
      })

      it('should return false for non-numbers', () => {
        expect(isNumber('123')).toBe(false)
        expect(isNumber(true)).toBe(false)
        expect(isNumber(null)).toBe(false)
        expect(isNumber(undefined)).toBe(false)
        expect(isNumber({})).toBe(false)
        expect(isNumber([])).toBe(false)
      })
    })

    describe('isBoolean', () => {
      it('should return true for booleans', () => {
        expect(isBoolean(true)).toBe(true)
        expect(isBoolean(false)).toBe(true)
      })

      it('should return false for non-booleans', () => {
        expect(isBoolean('true')).toBe(false)
        expect(isBoolean(1)).toBe(false)
        expect(isBoolean(0)).toBe(false)
        expect(isBoolean(null)).toBe(false)
        expect(isBoolean(undefined)).toBe(false)
        expect(isBoolean({})).toBe(false)
        expect(isBoolean([])).toBe(false)
      })
    })

    describe('isObject', () => {
      it('should return true for objects', () => {
        expect(isObject({})).toBe(true)
        expect(isObject({ key: 'value' })).toBe(true)
        expect(isObject(new Date())).toBe(true)
      })

      it('should return false for non-objects', () => {
        expect(isObject(null)).toBe(false)
        expect(isObject([])).toBe(false)
        expect(isObject('string')).toBe(false)
        expect(isObject(123)).toBe(false)
        expect(isObject(true)).toBe(false)
        expect(isObject(undefined)).toBe(false)
      })
    })

    describe('isArray', () => {
      it('should return true for arrays', () => {
        expect(isArray([])).toBe(true)
        expect(isArray([1, 2, 3])).toBe(true)
        expect(isArray(['a', 'b'])).toBe(true)
      })

      it('should return false for non-arrays', () => {
        expect(isArray({})).toBe(false)
        expect(isArray('string')).toBe(false)
        expect(isArray(123)).toBe(false)
        expect(isArray(true)).toBe(false)
        expect(isArray(null)).toBe(false)
        expect(isArray(undefined)).toBe(false)
      })
    })

    describe('isFunction', () => {
      it('should return true for functions', () => {
        expect(isFunction(testArrowFunction)).toBe(true)
        expect(isFunction(testRegularFunction)).toBe(true)
        expect(isFunction(testAsyncFunction)).toBe(true)
      })

      it('should return false for non-functions', () => {
        expect(isFunction({})).toBe(false)
        expect(isFunction('string')).toBe(false)
        expect(isFunction(123)).toBe(false)
        expect(isFunction(true)).toBe(false)
        expect(isFunction(null)).toBe(false)
        expect(isFunction(undefined)).toBe(false)
        expect(isFunction([])).toBe(false)
      })
    })

    describe('isNullOrUndefined', () => {
      it('should return true for null and undefined', () => {
        expect(isNullOrUndefined(null)).toBe(true)
        expect(isNullOrUndefined(undefined)).toBe(true)
      })

      it('should return false for other values', () => {
        expect(isNullOrUndefined('')).toBe(false)
        expect(isNullOrUndefined(0)).toBe(false)
        expect(isNullOrUndefined(false)).toBe(false)
        expect(isNullOrUndefined({})).toBe(false)
        expect(isNullOrUndefined([])).toBe(false)
      })
    })

    describe('isNotNullOrUndefined', () => {
      it('should return true for non-null/undefined values', () => {
        expect(isNotNullOrUndefined('')).toBe(true)
        expect(isNotNullOrUndefined(0)).toBe(true)
        expect(isNotNullOrUndefined(false)).toBe(true)
        expect(isNotNullOrUndefined({})).toBe(true)
        expect(isNotNullOrUndefined([])).toBe(true)
      })

      it('should return false for null and undefined', () => {
        expect(isNotNullOrUndefined(null)).toBe(false)
        expect(isNotNullOrUndefined(undefined)).toBe(false)
      })
    })
  })

  describe('Object Property Guards', () => {
    describe('hasProperty', () => {
      it('should return true for objects with the property', () => {
        expect(hasProperty({ key: 'value' }, 'key')).toBe(true)
        expect(hasProperty({ a: 1, b: 2 }, 'a')).toBe(true)
        expect(hasProperty({ undefined: 'value' }, 'undefined')).toBe(true)
      })

      it('should return false for objects without the property', () => {
        expect(hasProperty({ key: 'value' }, 'other')).toBe(false)
        expect(hasProperty({}, 'key')).toBe(false)
      })

      it('should return false for non-objects', () => {
        expect(hasProperty('string', 'key')).toBe(false)
        expect(hasProperty(123, 'key')).toBe(false)
        expect(hasProperty(null, 'key')).toBe(false)
        expect(hasProperty(undefined, 'key')).toBe(false)
      })
    })

    describe('hasRequiredProperties', () => {
      it('should return true for objects with all required properties', () => {
        const obj = { a: 1, b: 2, c: 3 }
        expect(hasRequiredProperties(obj, ['a', 'b'])).toBe(true)
        expect(hasRequiredProperties(obj, ['a', 'b', 'c'])).toBe(true)
      })

      it('should return false for objects missing required properties', () => {
        const obj = { a: 1, b: 2 }
        expect(hasRequiredProperties(obj, ['a', 'b', 'c'])).toBe(false)
        expect(hasRequiredProperties(obj, ['d'])).toBe(false)
      })

      it('should return false for non-objects', () => {
        expect(hasRequiredProperties('string', ['key'])).toBe(false)
        expect(hasRequiredProperties(123, ['key'])).toBe(false)
        expect(hasRequiredProperties(null, ['key'])).toBe(false)
        expect(hasRequiredProperties(undefined, ['key'])).toBe(false)
      })

      it('should return true for empty required properties array', () => {
        expect(hasRequiredProperties({}, [])).toBe(true)
        expect(hasRequiredProperties({ a: 1 }, [])).toBe(true)
      })
    })
  })

  describe('Validation Guards', () => {
    describe('isValidSHA', () => {
      it('should return true for valid SHA formats', () => {
        expect(isValidSHA('abc1234')).toBe(true) // Short SHA
        expect(isValidSHA('abc123456789')).toBe(true) // Medium SHA
        expect(isValidSHA('a1b2c3d4e5f6789012345678901234567890abcd')).toBe(
          true
        ) // Full SHA-1
        expect(isValidSHA('ABCDEF1234567890abcdef1234567890abcdef12')).toBe(
          true
        ) // Uppercase
      })

      it('should return false for invalid SHA formats', () => {
        expect(isValidSHA('abc123')).toBe(false) // Too short
        expect(isValidSHA('abc12345678901234567890123456789012345678901')).toBe(
          false
        ) // Too long
        expect(isValidSHA('abc123g')).toBe(false) // Invalid character
        expect(isValidSHA('')).toBe(false) // Empty
        expect(isValidSHA('not-a-sha')).toBe(false) // Invalid format
      })

      it('should return false for non-strings', () => {
        expect(isValidSHA(123)).toBe(false)
        expect(isValidSHA(null)).toBe(false)
        expect(isValidSHA(undefined)).toBe(false)
        expect(isValidSHA({})).toBe(false)
      })
    })

    describe('isValidQualityScore', () => {
      it('should return true for valid quality scores', () => {
        expect(isValidQualityScore(0)).toBe(true)
        expect(isValidQualityScore(50)).toBe(true)
        expect(isValidQualityScore(100)).toBe(true)
        expect(isValidQualityScore(85.5)).toBe(true)
      })

      it('should return false for invalid quality scores', () => {
        expect(isValidQualityScore(-1)).toBe(false)
        expect(isValidQualityScore(101)).toBe(false)
        expect(isValidQualityScore(150)).toBe(false)
      })

      it('should return false for non-numbers', () => {
        expect(isValidQualityScore('85')).toBe(false)
        expect(isValidQualityScore(null)).toBe(false)
        expect(isValidQualityScore(undefined)).toBe(false)
        expect(isValidQualityScore({})).toBe(false)
      })
    })

    describe('isValidFilePath', () => {
      it('should return true for valid file paths', () => {
        expect(isValidFilePath('file.txt')).toBe(true)
        expect(isValidFilePath('/path/to/file.md')).toBe(true)
        expect(isValidFilePath(String.raw`C:\path\to\file.txt`)).toBe(true)
        expect(isValidFilePath('file')).toBe(true) // No extension
      })

      it('should return false for invalid file paths', () => {
        expect(isValidFilePath('')).toBe(false) // Empty
        expect(isValidFilePath('file\0name.txt')).toBe(false) // Contains null byte
        expect(isValidFilePath('file\x00name.txt')).toBe(false) // Contains null byte
      })

      it('should return false for non-strings', () => {
        expect(isValidFilePath(123)).toBe(false)
        expect(isValidFilePath(null)).toBe(false)
        expect(isValidFilePath(undefined)).toBe(false)
        expect(isValidFilePath({})).toBe(false)
      })
    })

    describe('isGitHubAPIError', () => {
      it('should return true for GitHub API errors', () => {
        expect(isGitHubAPIError({ status: 404, message: 'Not found' })).toBe(
          true
        )
        expect(isGitHubAPIError({ status: 403 })).toBe(true)
        expect(isGitHubAPIError({ message: 'Error message' })).toBe(true)
      })

      it('should return false for non-GitHub API errors', () => {
        expect(isGitHubAPIError({ other: 'property' })).toBe(false)
        expect(isGitHubAPIError('string')).toBe(false)
        expect(isGitHubAPIError(123)).toBe(false)
        expect(isGitHubAPIError(null)).toBe(false)
        expect(isGitHubAPIError(undefined)).toBe(false)
        expect(isGitHubAPIError([])).toBe(false)
      })
    })

    describe('isApiError', () => {
      it('should return true for API errors', () => {
        expect(isApiError({ status: 500, message: 'Internal error' })).toBe(
          true
        )
        expect(isApiError({ status: 400 })).toBe(true)
        expect(isApiError({ message: 'Error message' })).toBe(true)
      })

      it('should return false for non API errors', () => {
        expect(isApiError({ other: 'property' })).toBe(false)
        expect(isApiError('string')).toBe(false)
        expect(isApiError(123)).toBe(false)
        expect(isApiError(null)).toBe(false)
        expect(isApiError(undefined)).toBe(false)
        expect(isApiError([])).toBe(false)
      })
    })
  })

  describe('Safe Access Utilities', () => {
    describe('safeGet', () => {
      it('should return property value for valid objects', () => {
        const obj = { a: 1, b: 'test', c: null }
        expect(safeGet(obj, 'a')).toBe(1)
        expect(safeGet(obj, 'b')).toBe('test')
        expect(safeGet(obj, 'c')).toBe(null)
      })

      it('should return undefined for missing properties', () => {
        const obj: Record<string, unknown> = { a: 1 }
        expect(safeGet(obj, 'b')).toBeUndefined()
        expect(safeGet(obj, 'c')).toBeUndefined()
      })

      it('should return undefined for null/undefined objects', () => {
        expect(
          safeGet<Record<string, unknown>, string>(null, 'key')
        ).toBeUndefined()
        expect(
          safeGet<Record<string, unknown>, string>(undefined, 'key')
        ).toBeUndefined()
      })
    })

    describe('safeArrayGet', () => {
      it('should return element for valid array access', () => {
        const arr = ['a', 'b', 'c']
        expect(safeArrayGet(arr, 0)).toBe('a')
        expect(safeArrayGet(arr, 1)).toBe('b')
        expect(safeArrayGet(arr, 2)).toBe('c')
      })

      it('should return undefined for out-of-bounds access', () => {
        const arr = ['a', 'b', 'c']
        expect(safeArrayGet(arr, 3)).toBeUndefined()
        expect(safeArrayGet(arr, -1)).toBeUndefined()
        expect(safeArrayGet(arr, 10)).toBeUndefined()
      })

      it('should return undefined for non-arrays', () => {
        expect(safeArrayGet(createInvalidArray('string'), 0)).toBeUndefined()
        expect(safeArrayGet(createInvalidArray(123), 0)).toBeUndefined()
        expect(safeArrayGet(createInvalidArray(null), 0)).toBeUndefined()
        expect(safeArrayGet(createInvalidArray(undefined), 0)).toBeUndefined()
        expect(safeArrayGet(createInvalidArray({}), 0)).toBeUndefined()
      })

      it('should return undefined for invalid indices', () => {
        const arr = ['a', 'b', 'c']
        expect(safeArrayGet(arr, createInvalidNumber('0'))).toBe('a') // String '0' is converted to number 0
        expect(safeArrayGet(arr, createInvalidNumber(null))).toBeUndefined()
        expect(
          safeArrayGet(arr, createInvalidNumber(undefined))
        ).toBeUndefined()
      })
    })
  })
})
