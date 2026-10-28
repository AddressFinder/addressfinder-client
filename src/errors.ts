/**
 * A failure that came back from the API, or from fetch itself.
 *
 * @group Errors
 */
export class ApiRequestError extends Error {
  readonly code: string | undefined
  readonly status: number | undefined

  constructor(message: string, options: { code?: string; status?: number } = {}) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = options.code
    this.status = options.status
  }
}

/** True for the DOMException fetch throws when an AbortSignal fires. */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}
