# Contributing

## Development

Node 24 (see `.nvmrc`).

```sh
npm install
npm run check   # typecheck, lint (including the browser compat check), test, build, package lint
```

## Releases

1. `git switch main && git pull`. `npm version` commits and tags whatever branch you're on, so start from an up-to-date `main`.
2. `npm version <patch|minor|major>`, then `git push origin main --follow-tags`. The `v*` tag makes GitHub Actions stage the version on npm through trusted publishing. Staged versions aren't installable yet.
3. Signed in to npm as the `addressfinder` account, find the staged version with `npm stage list @addressfinder/addressfinder-client`. Wait until its status is no longer `validating`: npm's automated review runs first, and approving before it finishes fails with `E409 ... automated review hasn't finished`.
4. Publish it with `npm stage approve <stage-id>`, which asks for 2FA. `npm stage reject <stage-id>` discards it instead.
5. Check the release with `npm view @addressfinder/addressfinder-client dist-tags`, which reads the registry. The npm website can take a while to show a new version. Then `npm logout`.
