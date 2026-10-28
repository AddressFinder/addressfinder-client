# Addressfinder client

The browser-side session client for the Addressfinder V4 API. It turns a publishable key into a session and makes lookups on it, for `addressfinder-js` and for customers building their own UI.

## Language

**Publishable key**:
A key prefixed `pk_` that is safe to put in a web page, because all it can do is start sessions.
_Avoid_: public key, API key

**Session**:
One page visit's access to the V4 API, held as a session token until the API refuses it.
_Avoid_: connection, login

**Session token**:
The short-lived token the API issues at a session start, carried on every lookup.
_Avoid_: access token, JWT, `ses`

**Session start**:
The exchange of a publishable key, client agent and fingerprint for a session token.
_Avoid_: handshake, login, auth

**Lookup**:
A request to a V4 API endpoint made on a session.
_Avoid_: query, search, call

**Client agent**:
The string naming the library and version that made a request, sent as `ca`.
_Avoid_: user agent

**Fingerprint**:
A string of stable browser signals sent at a session start, prefixed with its recipe, so the API can link a visit's sessions and tell automation from a person. Computed by the client alone; callers never supply it.
_Avoid_: device ID, browser ID

**Recipe**:
The fixed list and order of signals a fingerprint prefix (such as `v1`) stands for.
