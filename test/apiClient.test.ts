import { readFileSync } from 'node:fs'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createApiClient } from '../src/ApiClient.js'
import { ApiRequestError } from '../src/errors.js'

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' }
})

const isSessionStart = (url: string): boolean => new URL(url).pathname === '/api/session'

/**
 * The browser session: a publishable key is swapped for a token at
 * `POST /api/session`, and every lookup carries the token as `ses`.
 */
describe('the API client session', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  interface Call { url: URL, init: RequestInit | undefined }

  /**
   * Answers each session start with the next token, and each lookup with
   * `lookup` - or an empty list.
   */
  const stub = (options: {
    session?: (n: number, init: RequestInit | undefined) => Response | Promise<Response>
    lookup?: (url: URL, n: number) => Response | Promise<Response>
  } = {}): Call[] => {
    const calls: Call[] = []
    let sessions = 0
    let lookups = 0
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      const parsed = new URL(String(url))
      calls.push({ url: parsed, init })
      if (isSessionStart(parsed.href)) {
        sessions += 1
        return await (options.session?.(sessions, init) ?? json({ access_token: `token-${sessions}` }))
      }
      lookups += 1
      return await (options.lookup?.(parsed, lookups) ?? json({ completions: [] }))
    }))
    return calls
  }

  const sessionStarts = (calls: Call[]): Call[] => calls.filter((c) => isSessionStart(c.url.href))
  const lookups = (calls: Call[]): Call[] => calls.filter((c) => !isSessionStart(c.url.href))

  const client = (onError: (error: Error) => void = () => {}): ReturnType<typeof createApiClient> =>
    createApiClient({
      baseUrl: 'https://api.example.test',
      key: 'pk_test',
      clientAgent: () => 'MyCheckout/9.9.9',
      onSessionError: onError
    })

  const signal = (): AbortSignal => new AbortController().signal

  // The cooldown is measured on performance.now(), which vitest does not fake
  // by default.
  const useFakeClock = (): void => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] })
  }

  it('starts a session as a form-encoded POST with no custom headers', async () => {
    const calls = stub()
    await client().get('/api/v4/address/autocomplete', { q: 'wil' }, signal())

    const [start] = sessionStarts(calls)
    expect(start?.init?.method).toBe('POST')
    expect(start?.init?.headers).toBeUndefined()
    expect(start?.init?.body).toBeInstanceOf(URLSearchParams)
    expect(Object.fromEntries(start?.init?.body as URLSearchParams)).toEqual({
      key: 'pk_test', ca: 'MyCheckout/9.9.9'
    })
  })

  it('refuses a key that is not a publishable key', () => {
    expect(() => createApiClient({ baseUrl: 'https://api.example.test', key: 'sk_secret' }))
      .toThrow(/publishable key/)
  })

  it('says the same when a plain-JavaScript caller passes no key', () => {
    expect(() => createApiClient({ baseUrl: 'https://api.example.test', key: undefined as unknown as string }))
      .toThrow(/publishable key/)
  })

  describe('the client agent', () => {
    // From package.json, which `npm version` moves: the source has to follow it.
    const own = `Addressfinder-client/${(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version}`

    const ca = (calls: Call[]): Array<string | null> => calls.map((c) =>
      isSessionStart(c.url.href) ? (c.init?.body as URLSearchParams).get('ca') : c.url.searchParams.get('ca'))

    it("is the package's own when the caller gives none, because the API refuses a session without one", async () => {
      const calls = stub()
      await createApiClient({ baseUrl: 'https://api.example.test', key: 'pk_test' })
        .get('/a', {}, signal())

      expect(ca(calls)).toEqual([own, own])
    })

    it("falls back to the package's own over 100 characters, which the API refuses, and says so once", async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const calls = stub()
      const api = createApiClient({ baseUrl: 'https://api.example.test', key: 'pk_test', clientAgent: () => 'x'.repeat(101) })
      await api.get('/a', {}, signal())
      await api.get('/b', {}, signal())

      expect(ca(calls)).toEqual([own, own, own])
      expect(warn).toHaveBeenCalledOnce()
      expect(warn.mock.calls[0]?.[0]).toMatch(/100/)
      warn.mockRestore()
    })

    it("is the package's own when the caller's is empty, which the API refuses too", async () => {
      const calls = stub()
      await createApiClient({ baseUrl: 'https://api.example.test', key: 'pk_test', clientAgent: () => '' })
        .get('/a', {}, signal())

      expect(ca(calls)).toEqual([own, own])
    })

    it('sends a caller agent of exactly 100 characters as given', async () => {
      const calls = stub()
      await createApiClient({ baseUrl: 'https://api.example.test', key: 'pk_test', clientAgent: () => 'x'.repeat(100) })
        .get('/a', {}, signal())

      expect(ca(calls)).toEqual(['x'.repeat(100), 'x'.repeat(100)])
    })
  })

  it("sends the browser's fingerprint on a session start", async () => {
    vi.stubGlobal('navigator', { webdriver: false, languages: ['en-NZ'], userAgent: 'Chrome/130.0' })
    vi.stubGlobal('window', { screen: { width: 1920, height: 1080 }, outerWidth: 1920 })
    const calls = stub()
    await client().get('/api/v4/address/autocomplete', {}, signal())

    // Eleven slots; the recipe itself is pinned in fingerprint.test.ts.
    expect((sessionStarts(calls)[0]?.init?.body as URLSearchParams).get('fingerprint'))
      .toMatch(/^v1:(?:[^|]*\|){10}[^|]*$/)
  })

  it('leaves the fingerprint off under SSR', async () => {
    const calls = stub()
    await client().get('/api/v4/address/autocomplete', {}, signal())

    expect([...(sessionStarts(calls)[0]?.init?.body as URLSearchParams).keys()]).toEqual(['key', 'ca'])
  })

  it('sends the token as ses on a lookup, with ca, and no key, format or header', async () => {
    const calls = stub()
    await client().get('/api/v4/address/autocomplete', { q: 'wil' }, signal())

    const [lookup] = lookups(calls)
    expect(lookup?.url.searchParams.get('ses')).toBe('token-1')
    expect(lookup?.url.searchParams.get('ca')).toBe('MyCheckout/9.9.9')
    expect(lookup?.url.searchParams.get('q')).toBe('wil')
    expect(lookup?.url.searchParams.has('key')).toBe(false)
    expect(lookup?.url.searchParams.has('format')).toBe(false)
    expect(lookup?.init?.headers).toBeUndefined()
  })

  it('reuses the token, and never looks inside it', async () => {
    const calls = stub({ session: () => json({ access_token: 'not-a-jwt' }) })
    const api = client()
    await api.get('/a', {}, signal())
    await api.get('/b', {}, signal())

    expect(sessionStarts(calls)).toHaveLength(1)
    expect(lookups(calls).map((c) => c.url.searchParams.get('ses'))).toEqual(['not-a-jwt', 'not-a-jwt'])
  })

  it('shares one session start between concurrent lookups', async () => {
    const calls = stub()
    const api = client()
    await Promise.all([api.get('/a', {}, signal()), api.get('/b', {}, signal()), api.get('/c', {}, signal())])

    expect(sessionStarts(calls)).toHaveLength(1)
  })

  it.each(['1030', '1024'])('starts a new session and retries once on %s', async (code) => {
    const calls = stub({
      lookup: (_url, n) => n === 1 ? json({ message: 'no', error_code: code }, 401) : json({ completions: ['ok'] })
    })

    const body = await client().get('/a', {}, signal())

    expect(body).toEqual({ completions: ['ok'] })
    expect(sessionStarts(calls)).toHaveLength(2)
    expect(lookups(calls).map((c) => c.url.searchParams.get('ses'))).toEqual(['token-1', 'token-2'])
  })

  it('reports a second refusal without retrying again, and starts afresh next time', async () => {
    const calls = stub({
      lookup: (_url, n) => n <= 2 ? json({ message: 'Token has expired', error_code: '1030' }, 401) : json({})
    })
    const errors: Error[] = []
    const api = client((error) => errors.push(error))

    await expect(api.get('/a', {}, signal())).rejects.toMatchObject({ code: '1030' })
    expect(sessionStarts(calls)).toHaveLength(2)

    await api.get('/b', {}, signal())
    expect(sessionStarts(calls)).toHaveLength(3)
    expect(lookups(calls).at(-1)?.url.searchParams.get('ses')).toBe('token-3')
    // A refused lookup is the lookup's failure, not the session's.
    expect(errors).toEqual([])
  })

  it('reports any other lookup error for that lookup alone', async () => {
    const calls = stub({
      lookup: (_url, n) => n === 1 ? json({ message: 'Invalid include', error_code: '1000' }, 400) : json({})
    })
    const api = client()

    await expect(api.get('/a', {}, signal())).rejects.toMatchObject({ code: '1000', message: 'Invalid include' })
    await api.get('/b', {}, signal())

    expect(sessionStarts(calls)).toHaveLength(1)
  })

  it('shares one renewal between concurrent lookups refused with the same token', async () => {
    const calls = stub({
      lookup: (url) => url.searchParams.get('ses') === 'token-1' ? json({ error_code: '1030' }, 401) : json({})
    })
    const api = client()

    await Promise.all([api.get('/a', {}, signal()), api.get('/b', {}, signal())])

    expect(sessionStarts(calls)).toHaveLength(2)
    expect(lookups(calls).map((c) => c.url.searchParams.get('ses'))).toEqual(['token-1', 'token-1', 'token-2', 'token-2'])
  })

  describe('a failed session start', () => {
    it.each([
      ['a refusal with the API\'s error code', () => json({ message: 'Origin not registered', error_code: '1003' }, 400)],
      ['a 5xx', () => json({ message: 'Bad gateway' }, 502)],
      ['a 429', () => json({ message: 'Slow down' }, 429)],
      ['a network error', () => { throw new TypeError('Failed to fetch') }],
      ['a 200 with no token', () => json({})],
      // Not the API's answer - a CDN or proxy in front of it.
      ['a 4xx with no API error code', () => new Response('<html>Forbidden</html>', { status: 403 })]
    ])('starts nothing for 30s after %s, then tries again', async (_name, failure) => {
      useFakeClock()
      const calls = stub({ session: (n) => n === 1 ? failure() : json({ access_token: 'later' }) })
      const errors: Error[] = []
      const api = client((error) => errors.push(error))

      const thrown = await api.get('/a', {}, signal()).catch((error: unknown) => error)
      expect(errors).toHaveLength(1)
      expect(thrown).toBe(errors[0])

      await vi.advanceTimersByTimeAsync(29_999)
      // The same object, so the caller knows it has been reported.
      await expect(api.get('/b', {}, signal())).rejects.toBe(errors[0])
      api.startSession()
      expect(sessionStarts(calls)).toHaveLength(1)
      expect(lookups(calls)).toHaveLength(0)

      await vi.advanceTimersByTimeAsync(1)
      await api.get('/c', {}, signal())

      expect(errors).toHaveLength(1)
      expect(sessionStarts(calls)).toHaveLength(2)
      expect(lookups(calls).map((c) => c.url.searchParams.get('ses'))).toEqual(['later'])
    })

    it('hands every waiting lookup the one error, and reports it once', async () => {
      const calls = stub({ session: () => json({ message: 'Origin not registered', error_code: '1003' }, 400) })
      const errors: Error[] = []
      const api = client((error) => errors.push(error))

      const first = await Promise.allSettled([api.get('/a', {}, signal()), api.get('/b', {}, signal())])

      expect(sessionStarts(calls)).toHaveLength(1)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBeInstanceOf(ApiRequestError)
      expect(errors[0]).toMatchObject({ code: '1003', status: 400, message: 'Origin not registered' })
      for (const result of first) expect(result).toMatchObject({ status: 'rejected', reason: errors[0] })
    })

    it('reports each failed start, one per 30s', async () => {
      useFakeClock()
      const calls = stub({ session: () => json({ message: 'Key not found', error_code: '1001' }, 400) })
      const errors: Error[] = []
      const api = client((error) => errors.push(error))

      await api.get('/a', {}, signal()).catch(() => {})
      await vi.advanceTimersByTimeAsync(30_000)
      await api.get('/b', {}, signal()).catch(() => {})
      await api.get('/c', {}, signal()).catch(() => {})

      expect(sessionStarts(calls)).toHaveLength(2)
      expect(errors).toHaveLength(2)
      expect(errors[0]).not.toBe(errors[1])
    })

    it('counts the 30s from when a start that never answers is abandoned', async () => {
      useFakeClock()
      const aborted: boolean[] = []
      const calls = stub({
        session: async (n, init) => n === 1
          ? await new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              aborted.push(true)
              reject(new DOMException('Aborted', 'AbortError'))
            })
          })
          : json({ access_token: 'later' })
      })
      const errors: Error[] = []
      const api = client((error) => errors.push(error))

      const settled = expect(api.get('/a', {}, signal())).rejects.toMatchObject({ name: 'ApiRequestError' })
      await vi.advanceTimersByTimeAsync(6_000)
      await settled

      expect(aborted).toEqual([true])
      expect(errors).toHaveLength(1)
      expect(errors[0]?.message).toMatch(/6000ms/)

      await vi.advanceTimersByTimeAsync(29_999)
      api.startSession()
      expect(sessionStarts(calls)).toHaveLength(1)

      await vi.advanceTimersByTimeAsync(1)
      await api.get('/b', {}, signal())
      expect(sessionStarts(calls)).toHaveLength(2)
    })

    it('abandons a start whose body never arrives, and waits 30s from then', async () => {
      useFakeClock()
      const calls = stub({
        session: (n, init) => n === 1
          // Headers, then a body that only ever ends by being aborted.
          ? new Response(new ReadableStream({
            start (controller) {
              init?.signal?.addEventListener('abort', () => {
                controller.error(new DOMException('Aborted', 'AbortError'))
              })
            }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
          : json({ access_token: 'later' })
      })
      const errors: Error[] = []
      const api = client((error) => errors.push(error))

      const settled = expect(api.get('/a', {}, signal())).rejects.toMatchObject({ name: 'ApiRequestError' })
      await vi.advanceTimersByTimeAsync(6_000)
      await settled

      expect(errors).toHaveLength(1)
      expect(errors[0]?.message).toMatch(/6000ms/)

      await vi.advanceTimersByTimeAsync(30_000)
      await api.get('/b', {}, signal())
      expect(sessionStarts(calls)).toHaveLength(2)
    })

    it('starts the 30s when the start renewing a refused token fails', async () => {
      useFakeClock()
      const calls = stub({
        session: (n) => n === 1 ? json({ access_token: 'token-1' }) : json({ message: 'Key not found', error_code: '1001' }, 400),
        lookup: () => json({ message: 'Invalid bearer token', error_code: '1024' }, 401)
      })
      const errors: Error[] = []
      const api = client((error) => errors.push(error))

      await expect(api.get('/a', {}, signal())).rejects.toMatchObject({ code: '1001' })
      await expect(api.get('/b', {}, signal())).rejects.toBe(errors[0])

      expect(errors).toHaveLength(1)
      expect(sessionStarts(calls)).toHaveLength(2)
      expect(lookups(calls)).toHaveLength(1)
    })
  })

  it('does not cancel a session start when one waiting lookup is abandoned', async () => {
    let answer: (response: Response) => void = () => {}
    const calls = stub({ session: async () => await new Promise<Response>((resolve) => { answer = resolve }) })
    const api = client()

    const abandoned = new AbortController()
    const first = api.get('/a', {}, abandoned.signal)
    const second = api.get('/b', {}, signal())
    await Promise.resolve()
    abandoned.abort()

    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    expect(sessionStarts(calls)[0]?.init?.signal?.aborted).toBe(false)

    answer(json({ access_token: 'token-1' }))
    await second
    expect(lookups(calls).map((c) => c.url.pathname)).toEqual(['/b'])
  })

  describe('startSession', () => {
    it('starts one ahead of the first lookup, and does nothing while one is held', async () => {
      const calls = stub()
      const api = client()

      api.startSession()
      api.startSession()
      await api.get('/a', {}, signal())
      api.startSession()

      expect(sessionStarts(calls)).toHaveLength(1)
    })

    it('reports a failure nothing was waiting on', async () => {
      stub({ session: () => json({ message: 'Key not found', error_code: '1001' }, 400) })
      const errors: Error[] = []

      client((error) => errors.push(error)).startSession()
      await vi.waitFor(() => { expect(errors).toHaveLength(1) })

      expect(errors[0]).toMatchObject({ code: '1001', message: 'Key not found' })
    })
  })
})
