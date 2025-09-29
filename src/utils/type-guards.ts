/**
 * Type guard utilities for improved type safety
 */

/**
 * Type guard for checking if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/**
 * Type guard for checking if a value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value)
}

/**
 * Type guard for checking if a value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

/**
 * Type guard for checking if a value is an object (but not null)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Type guard for checking if a value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

/**
 * Type guard for checking if a value is a function
 */
export function isFunction(
  value: unknown
): value is (...args: unknown[]) => unknown {
  return typeof value === 'function'
}

/**
 * Type guard for checking if a value is null or undefined
 */
export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined
}

/**
 * Type guard for checking if a value is not null or undefined
 */
export function isNotNullOrUndefined<T>(
  value: T | null | undefined
): value is T {
  return value !== null && value !== undefined
}

/**
 * Type guard for checking if an object has a specific property
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj
}

/**
 * Type guard for checking if an object has all required properties
 */
export function hasRequiredProperties<T extends Record<string, unknown>>(
  obj: unknown,
  requiredKeys: (keyof T)[]
): obj is T {
  if (!isObject(obj)) return false
  return requiredKeys.every((key) => key in obj)
}

/**
 * Type guard for checking if a value is a valid SHA
 */
export function isValidSHA(value: unknown): value is string {
  if (!isString(value)) return false
  // SHA-1 is 40 characters, short SHA is 7+ characters
  return /^[a-fA-F0-9]{7,40}$/.test(value)
}

/**
 * Type guard for checking if a value is a valid quality score
 */
export function isValidQualityScore(value: unknown): value is number {
  if (!isNumber(value)) return false
  return value >= 0 && value <= 100
}

/**
 * Type guard for checking if a value is a valid file path
 */
export function isValidFilePath(value: unknown): value is string {
  if (!isString(value)) return false
  return value.length > 0 && !value.includes('\0')
}

/**
 * Type guard for checking if an error is a GitHub API error
 */
export function isGitHubAPIError(
  error: unknown
): error is { status?: number; message?: string } {
  return isObject(error) && ('status' in error || 'message' in error)
}

/**
 * Type guard for checking if an error is an API error
 */
export function isApiError(
  error: unknown
): error is { status?: number; message?: string } {
  return isObject(error) && ('status' in error || 'message' in error)
}

/**
 * Safe property access with type guard
 */
export function safeGet<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K
): T[K] | undefined {
  if (isNullOrUndefined(obj)) return undefined
  return obj[key]
}

/**
 * Safe array access with bounds checking
 */
export function safeArrayGet<T>(array: T[], index: number): T | undefined {
  if (!isArray(array) || index < 0 || index >= array.length) {
    return undefined
  }
  return array[index]
}
