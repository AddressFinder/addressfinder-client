/**
 * The browser's fingerprint, sent with every session start. The client
 * computes it alone; callers never supply it.
 *
 * The recipe is the prefix: change a signal and the prefix moves with it.
 * Every signal is stable for one browser - nothing random, nothing a window
 * resize changes - and each has a fixed slot, empty when the browser does not
 * offer it, so no signal shifts another's position.
 *
 * The `v1` recipe is shared with other Addressfinder libraries, so they must
 * match signal for signal: docs/adr/0001. The only file in the package that
 * reads the browser. `undefined` under SSR, and the parameter is then
 * left off.
 */
const RECIPE = 'v1'

let computed: string | undefined

export function fingerprint (): string | undefined {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return undefined
  computed ??= `${RECIPE}:${signals().join('|')}`
  return computed
}

function signals (): string[] {
  const flag = (value: boolean): string => (value ? '1' : '0')
  const text = (value: unknown): string => (value === undefined || value === null ? '' : String(value))

  return [
    flag(navigator.webdriver),
    text(Intl.DateTimeFormat().resolvedOptions().timeZone),
    text(navigator.platform),
    text(window.screen?.width),
    text(window.screen?.height),
    text(window.devicePixelRatio),
    text(navigator.hardwareConcurrency),
    (navigator.languages ?? []).join(','),
    flag(navigator.userAgent.includes('HeadlessChrome')),
    text(navigator.plugins?.length),
    flag(window.outerWidth === 0)
  ]
}
