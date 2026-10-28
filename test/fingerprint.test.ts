import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The fingerprint is computed once per page, so each test imports a fresh copy
 * after stubbing the browser it should see.
 */
const fingerprint = async (): Promise<string | undefined> => {
  vi.resetModules()
  return (await import('../src/fingerprint.js')).fingerprint()
}

const browser = (): void => {
  vi.stubEnv('TZ', 'Pacific/Auckland')
  vi.stubGlobal('navigator', {
    webdriver: false,
    platform: 'MacIntel',
    hardwareConcurrency: 8,
    languages: ['en-NZ', 'en'],
    userAgent: 'Mozilla/5.0 (Macintosh) Chrome/130.0',
    plugins: { length: 5 }
  })
  vi.stubGlobal('window', {
    screen: { width: 1920, height: 1080 },
    devicePixelRatio: 2,
    outerWidth: 1920
  })
}

describe('the browser fingerprint', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('is the v1 recipe: eleven signals in a fixed order', async () => {
    browser()

    // Pinned, because other libraries send the same recipe: see
    // docs/adr/0001.
    expect(await fingerprint()).toBe('v1:0|Pacific/Auckland|MacIntel|1920|1080|2|8|en-NZ,en|0|5|0')
  })

  it('leaves a slot empty, not out, when the browser does not offer a signal', async () => {
    browser()
    vi.stubGlobal('navigator', { ...navigator, platform: undefined, hardwareConcurrency: undefined })

    expect(await fingerprint()).toBe('v1:0|Pacific/Auckland||1920|1080|2||en-NZ,en|0|5|0')
  })

  it('flags automation', async () => {
    browser()
    vi.stubGlobal('navigator', { ...navigator, webdriver: true, userAgent: 'HeadlessChrome/130.0' })
    vi.stubGlobal('window', { ...window, outerWidth: 0 })

    expect(await fingerprint()).toBe('v1:1|Pacific/Auckland|MacIntel|1920|1080|2|8|en-NZ,en|1|5|1')
  })

  it('is undefined under SSR', async () => {
    expect(await fingerprint()).toBeUndefined()
  })
})
