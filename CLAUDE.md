# addressfinder-client

Node 24 on the host (`.nvmrc`), unlike addressfinder-js, which runs in Docker. `npm run check` is what CI runs.

## Related code

- **Consumer**: `../addressfinder-js` depends on this package. A change to an export or to session behaviour needs a matching change there.
- **Session endpoint**: the API's rules for a session start (a required `ca`, at most 100 characters) live in `../addressfinder-api/app/use_cases/sessions/issue_session_token.rb`.
- **Fingerprint**: the `v1` recipe is shared with `apiSession.js` in addressfinder-api. Read `docs/adr/0001-v1-fingerprint-recipe-is-a-shared-contract.md` before changing `src/fingerprint.ts`.

## Agent skills

### Issue tracker

Issues live in Linear, in the ADF team ("Addressfinder devs"), accessed through the Linear MCP. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
