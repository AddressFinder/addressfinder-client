# addressfinder-client

This repo is public: write every file for an outside reader. Names, paths and internals of private Addressfinder repos stay out of it; the `af-knowledge:platform-map` skill holds them.

Node 24 on the host (`.nvmrc`); `npm run check` is what CI runs.

## Related code

- **Other repos**: this package's consumers and the API's session rules live in private repos. `af-knowledge:platform-map` lists what a change here drags in.
- **Fingerprint**: read `docs/adr/0001-v1-fingerprint-recipe-is-a-shared-contract.md` before changing `src/fingerprint.ts`.

## Agent skills

### Issue tracker

Issues live in Linear, in the ADF team ("Addressfinder devs"), accessed through the Linear MCP. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
