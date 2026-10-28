# Coding standards

Rules for review. Lint, typecheck and `npm run lint:package` enforce the mechanical ones; these are the judgement calls.

## Comments describe this package as it stands

Code here came from addressfinder-js, and its comments can carry concepts this package doesn't have: typing, sources, searches, the autocomplete, the `transport/` and `presentation/` layers. A comment names only what exists here: the caller, a lookup, a session start. Comments follow the Addressfinder team rule: they explain a gotcha or a constraint the code can't show, in a line or two.

## Use the glossary

Code, comments, test names and the README use the terms in `CONTEXT.md` and avoid its _Avoid_ words: a **lookup**, not a query, call or search; a **session token**, not an access token; a **client agent**, not a user agent. The exported type `QueryParams` predates the glossary and keeps its name, since addressfinder-js depends on it.

## The README is the npm page

It is written for integrators: installing, configuring, handling errors and browser support. Contributor and release steps go in `CONTRIBUTING.md`. It names only things an integrator can install or call, and leaves out how the API's abuse checks work.

## The public surface stays small

Every export is a semver promise to customers. A new export, option or default needs a reason in the PR, and a matching change in addressfinder-js if it re-exports it.
