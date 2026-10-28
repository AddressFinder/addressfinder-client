# Issue tracker: Linear

Issues and specs for this repo live in Linear, in the **ADF** team ("Addressfinder devs"). Use the Linear MCP tools for all operations; there is no CLI.

## Conventions

- **Create an issue**: `save_issue` with `team: "ADF"`, a `title` and a markdown `description` (real newlines, no `\n` escapes).
- **Read an issue**: `get_issue` with the identifier (e.g. `ADF-5787`), then `list_comments` for the discussion.
- **List issues**: `list_issues` filtered by `team: "ADF"` plus `label`, `state`, `assignee` or `query` as needed.
- **Comment on an issue**: `save_comment` with the issue id and `body`.
- **Apply / remove labels**: `save_issue` with the issue `id` and the full `labels` list you want it to end with. Check `list_issue_labels` first and reuse an existing label rather than creating a duplicate.
- **Close**: `save_issue` setting `state` to Done (or Canceled for won't-do), after a `save_comment` explaining why.

Identifiers are `ADF-<number>`. Branches are named after the issue, and commit messages start with the uppercase identifier (`ADF-1234 ...`).

## When a skill says "publish to the issue tracker"

Create a Linear issue in the ADF team.

## When a skill says "fetch the relevant ticket"

`get_issue` with its `ADF-<number>` identifier (a `linear.app/addressfinder/issue/...` URL contains it), then `list_comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single parent issue with **child** issues as tickets.

- **Map**: an ADF issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body.
- **Child ticket**: an ADF issue created with `parentId` set to the map, so it shows as a sub-issue. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: Linear's native "blocked by" issue relation, set through `save_issue`. Where that can't be set, fall back to a `Blocked by: ADF-<n>, ADF-<n>` line at the top of the child description. A ticket is unblocked when every blocker is Done or Canceled.
- **Frontier query**: list the map's open children, drop any with an open blocker or an assignee; first in map order wins.
- **Claim**: `save_issue` setting `assignee: "me"`, the session's first write.
- **Resolve**: `save_comment` with the answer, then set the state to Done, then append a context pointer (gist + link) to the map's Decisions-so-far.
