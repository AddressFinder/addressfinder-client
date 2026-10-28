# Contributing

## Development

Node 24 (see `.nvmrc`).

```sh
npm install
npm run check   # typecheck, lint (including the browser compat check), test, build, package lint
```

## Releases

1. `npm version <patch|minor|major>` on `main`, then `git push origin main --follow-tags`. The `v*` tag makes GitHub Actions stage the version on npm through trusted publishing. Staged versions aren't installable yet.
2. Signed in to npm as the `addressfinder` account, find the staged version with `npm stage list @addressfinder/addressfinder-client`, then publish it with `npm stage approve <stage-id>`, which asks for 2FA. `npm stage reject <stage-id>` discards it instead.
