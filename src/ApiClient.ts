import { ApiRequestError, isAbortError } from './errors.js'
import { fingerprint } from './fingerprint.js'
import { VERSION } from './version.js'

/**
 * Extra API parameters for a lookup. An `undefined` value is left off.
 *
 * @group TypeScript types
 */
export type QueryParams = Record<string, string | number | undefined>

export interface ApiClient {
  /** A lookup, on the client's session - started first if none is held. */
  get<T>(path: string, params: QueryParams, signal: AbortSignal): Promise<T>
  /**
   * Starts a session ahead of the first lookup, unless one is held, starting
   * or refused. A failure is reported through the client's `onSessionError`.
   */
  startSession(): void
}

export interface ApiClientOptions {
  baseUrl: string
  /**
   * A publishable key, `pk_...`; anything else throws. Sent to the session
   * endpoint and nowhere else.
   */
  key: string
  /**
   * Names the library or integration making the lookups, sent as `ca`. Read on
   * every request, so it can change after the client is built. Defaults to
   * `Addressfinder-client/<version>`, which is also sent in place of an empty
   * value or one over 100 characters.
   */
  clientAgent?: () => string | undefined
  /**
   * Hears every failed session start, once, whether or not a lookup was
   * waiting on it. Each lookup that was is rejected with the same error object.
   */
  onSessionError?: (error: Error) => void
}

interface ApiError {
  message?: string
  error_code?: string
}

/**
 * How long a session start has before it is abandoned. Its own limit, because
 * a start begun by `startSession()` has no caller's signal around it, and one
 * that never settled would hold every later lookup waiting on it.
 */
const SESSION_TIMEOUT = 6_000

/**
 * How long after a failed session start no new one is started, counted from
 * when it settled. Whatever the failure, the next lookup or `startSession()`
 * after this tries again.
 */
export const SESSION_RETRY_DELAY = 30_000

const OWN_AGENT = `Addressfinder-client/${VERSION}`
const MAX_AGENT_LENGTH = 100

/**
 * The codes on a lookup that mean "start a new session". The API answers every
 * future refusal of that kind with `1024`, so this list does not grow.
 */
const START_AGAIN = new Set(['1030', '1024'])

/**
 * Thin wrapper over fetch, holding one browser session. No DOM outside
 * fingerprint.ts: this runs in Node, which keeps the package importable under SSR.
 *
 * The key is swapped for a token at `POST /api/session`, and every lookup
 * carries the token as the `ses` URL parameter. Neither request sends a custom
 * header, so neither is preflighted: a header would cost an `OPTIONS` round
 * trip on every new lookup. The token is never decoded and its expiry never
 * tracked - the lookup that finds it expired is answered `1030`, and is retried
 * once on a new session.
 *
 * A failed session start, whatever the cause, starts no new one for
 * `SESSION_RETRY_DELAY`: every lookup in that time is rejected with the same
 * error and sends nothing. Nothing runs on a timer - the first lookup or
 * `startSession()` after it tries again.
 */
export function createApiClient ({
  baseUrl, key, clientAgent, onSessionError
}: ApiClientOptions): ApiClient {
  // Thrown, not sent: a secret key in a page is leaked the moment it loads.
  if (typeof key !== 'string' || !key.startsWith('pk_')) {
    throw new Error('Addressfinder: createApiClient needs a publishable key (pk_...). Never put a secret key in a web page.')
  }

  // The API refuses a session start with no `ca`, or one over MAX_AGENT_LENGTH, and a
  // refused start stops every lookup - so there is always a usable one.
  let warned = false
  const agent = (): string => {
    const given = clientAgent?.()
    if (given === undefined || given === '') return OWN_AGENT
    if (given.length <= MAX_AGENT_LENGTH) return given
    if (!warned) {
      warned = true
      console.warn(
        `Addressfinder: the client agent is over the API's ${MAX_AGENT_LENGTH}-character limit, ` +
        `so ${OWN_AGENT} was sent instead.`
      )
    }
    return OWN_AGENT
  }

  let token: string | undefined
  let starting: Promise<string> | undefined
  let failed: { error: Error, at: number } | undefined

  const coolingDown = (): boolean =>
    failed !== undefined && performance.now() - failed.at < SESSION_RETRY_DELAY

  // The handlers here are attached before any waiter's, so a waiter that
  // retries as soon as it is rejected already finds the cooldown.
  const start = (): Promise<string> => {
    const attempt = requestToken()
    starting = attempt
    attempt.then(
      (issued) => {
        if (starting === attempt) starting = undefined
        token = issued
      },
      (error: Error) => {
        if (starting === attempt) starting = undefined
        failed = { error, at: performance.now() }
        onSessionError?.(error)
      }
    )
    return attempt
  }

  const requestToken = async (): Promise<string> => {
    const body = new URLSearchParams({ key })
    body.set('ca', agent())
    const print = fingerprint()
    if (print !== undefined) body.set('fingerprint', print)

    // Its own controller: a lookup that is abandoned must not cancel the
    // session the other lookups are waiting on.
    const controller = new AbortController()
    const timer = setTimeout(() => { controller.abort() }, SESSION_TIMEOUT)

    const timedOut = (): ApiRequestError =>
      new ApiRequestError(`The session start did not answer within ${SESSION_TIMEOUT}ms`)

    // The body is inside the timeout too: headers followed by a body that
    // stalls would otherwise hold the start open for good.
    let response: Response
    let answer: ({ access_token?: unknown } & ApiError) | undefined
    try {
      // URLSearchParams is sent form-encoded, which keeps this a simple request.
      response = await fetch(new URL('/api/session', baseUrl), {
        method: 'POST', body, signal: controller.signal
      })
      answer = await readBody<{ access_token?: unknown }>(response)
    } catch (error) {
      if (!isAbortError(error)) throw error
      throw timedOut()
    } finally {
      clearTimeout(timer)
    }
    // readBody turns an aborted read into no body, so ask the signal.
    if (controller.signal.aborted) throw timedOut()

    if (response.ok && typeof answer?.access_token === 'string') return answer.access_token

    throw new ApiRequestError(
      answer?.message ?? (response.ok ? 'Session response had no access_token' : `HTTP ${response.status}`),
      { code: answer?.error_code, status: response.status }
    )
  }

  /** The token, waited for under the caller's signal and nothing else. */
  const session = async (signal: AbortSignal): Promise<string> => {
    if (token !== undefined) return token
    if (starting !== undefined) return await underSignal(starting, signal)
    // The same object the failed start rejected with, so it is not reported again.
    if (failed !== undefined && coolingDown()) throw failed.error
    return await underSignal(start(), signal)
  }

  const lookup = async <T>(path: string, params: QueryParams, ses: string, signal: AbortSignal): Promise<T> => {
    const url = new URL(path, baseUrl)

    // Which library and version made the lookup. Set before the caller's own
    // params so a caller could override it deliberately, and so a typo in a
    // parameter bag cannot silently drop it.
    url.searchParams.set('ca', agent())

    for (const [name, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(name, String(value))
    }

    // Last, so no parameter bag can replace it.
    url.searchParams.set('ses', ses)

    const response = await fetch(url, { signal })

    // Read the body before deciding, because these APIs put the useful part
    // there on failures too: a refused lookup carries the reason, which tells
    // an integrator what to fix in a way that "HTTP 400" does not.
    const body = await readBody<T>(response)

    if (!response.ok) {
      throw new ApiRequestError(
        body?.message ?? `HTTP ${response.status}`,
        { code: body?.error_code, status: response.status }
      )
    }

    if (body === undefined) {
      throw new ApiRequestError('Response was not valid JSON', { status: response.status })
    }

    return body
  }

  /** Forgets a token the API refused, unless another lookup already has. */
  const drop = (refusedToken: string): void => {
    if (token === refusedToken) token = undefined
  }

  const startsAgain = (error: unknown): boolean =>
    error instanceof ApiRequestError && error.code !== undefined && START_AGAIN.has(error.code)

  return {
    async get<T>(path: string, params: QueryParams, signal: AbortSignal): Promise<T> {
      const first = await session(signal)
      try {
        return await lookup<T>(path, params, first, signal)
      } catch (error) {
        if (!startsAgain(error)) throw error
        drop(first)
      }

      // Once. A new token refused again is reported, and forgotten so the next
      // lookup starts afresh.
      const second = await session(signal)
      try {
        return await lookup<T>(path, params, second, signal)
      } catch (error) {
        if (startsAgain(error)) drop(second)
        throw error
      }
    },

    startSession() {
      if (token !== undefined || starting !== undefined || coolingDown()) return
      // Reported through onSessionError; nothing here is waiting on it.
      start().catch(() => {})
    }
  }
}

async function readBody<T> (response: Response): Promise<(T & ApiError) | undefined> {
  try {
    return (await response.json()) as T & ApiError
  } catch {
    return undefined
  }
}

/**
 * Waits on a shared promise until the caller gives up, without cancelling it
 * for anyone else.
 */
async function underSignal<T> (promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  return await new Promise<T>((resolve, reject) => {
    const abandon = (): void => { reject(new DOMException('Aborted', 'AbortError')) }
    signal.addEventListener('abort', abandon, { once: true })
    promise.then(
      (value) => { signal.removeEventListener('abort', abandon); resolve(value) },
      (error: unknown) => { signal.removeEventListener('abort', abandon); reject(error) }
    )
  })
}
