# @addressfinder/addressfinder-client

The session client for the [Addressfinder](https://addressfinder.com) V4 API, for pages that call it with a publishable key (`pk_...`). Use it to build your own address UI on the V4 API. `@addressfinder/addressfinder-js` uses it too.

It exchanges the publishable key for a short-lived session token, sends that token with every lookup, and starts a new session when the API refuses the old one.

```sh
npm install @addressfinder/addressfinder-client
```

## Usage

```ts
import { createApiClient, ApiRequestError } from '@addressfinder/addressfinder-client'

const client = createApiClient({
  baseUrl: 'https://api.addressfinder.io',
  key: 'pk_...',
  clientAgent: () => 'MyCheckout/2.3.0',              // optional
  onSessionError: (error) => console.warn(error)      // optional
})

// Optional: start the session ahead of the first lookup, e.g. on focus.
client.startSession()

const controller = new AbortController()
try {
  const result = await client.get('/api/v4/address/autocomplete', { q: '1 Willis St', country: 'nz' }, controller.signal)
} catch (error) {
  if (error instanceof ApiRequestError) console.log(error.code, error.status, error.message)
}
```

### Options

| Option | |
| --- | --- |
| `baseUrl` | The API host. |
| `key` | Your publishable key. Anything that doesn't start with `pk_` throws: never put a secret key in a web page. |
| `clientAgent` | Names your integration, as `Name/1.2.3`. Read on every request. Defaults to `Addressfinder-client/<version>`, which is also sent in place of an empty value or one over 100 characters (the API refuses both). |
| `onSessionError` | Called once for every session start that fails. |

### Sessions

* The first lookup (or `startSession()`) starts a session. Concurrent lookups share one start.
* A lookup the API refuses with `1030` or `1024` starts a new session and is retried once.
* A session start has 6 seconds to answer. After one fails, no new start is tried for 30 seconds (`SESSION_RETRY_DELAY`); lookups in that time reject with the same error.
* `client.get` rejects with an `ApiRequestError` carrying the API's `code` and the HTTP `status`, or with an `AbortError` when your signal fires.

## Browser fingerprint

Each session start sends a fingerprint so the API can link one visit's sessions and tell automation from a person. The API stores only a keyed hash of it. It is made of these signals, all read from the browser, none of them random or stored:

1. `navigator.webdriver`
2. The time zone
3. `navigator.platform`
4. Screen width
5. Screen height
6. `devicePixelRatio`
7. `navigator.hardwareConcurrency`
8. `navigator.languages`
9. Whether the user agent is HeadlessChrome
10. The number of plugins
11. Whether the window's outer width is 0

Under server-side rendering there is no browser, so no fingerprint is sent.

## Browser support

[Baseline widely available](https://web.dev/baseline). The package uses `fetch`, `AbortController` and ES2022, and imports cleanly under SSR.

## Development

Node 24 (see `.nvmrc`).

```sh
npm install
npm run check   # typecheck, lint (including the browser compat check), test, build
```

Releases: `npm version <patch|minor|major>`, then push the tag. The `v*` tag publishes to npm from GitHub Actions through trusted publishing.

## Licence

MIT
