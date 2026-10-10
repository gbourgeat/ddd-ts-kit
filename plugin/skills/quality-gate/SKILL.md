---
name: quality-gate
description: >-
  Runs the checks of a ddd-ts-kit project at the right scope (the changed files while
  iterating, the whole gate before a slice is closed or merged) and fixes what fails at the
  root cause. Use before closing a slice or opening a pull or merge request, when the user
  asks whether the work is clean, done or ready, or when a check, the guard or the pipeline
  reports a violation. For the size and message of the commit use commit-discipline.
allowed-tools:
  - Read
  - Edit
  - Bash(npm run verify)
  - Bash(npm run typecheck)
  - Bash(npm run lint *)
  - Bash(npm test *)
  - Bash(npm run test:coverage)
  - Bash(npm run test:e2e *)
  - Bash(npm run docs:check)
  - Bash(npm run docs:generate)
  - Bash(npm run depcruise)
  - Bash(npm run deadcode)
  - Bash(npx ddd-ts-kit check *)
  - Bash(npx ddd-ts-kit check)
  - Bash(npx ddd-ts-kit todo *)
  - Bash(npx ddd-ts-kit todo)
  - Bash(npx ddd-ts-kit status)
  - Bash(npx ddd-ts-kit docs)
  - Bash(npx ddd-ts-kit explain *)
---

# Quality gate

## Scope the run

| When | Run | Cost |
|---|---|---|
| after each write | nothing: the guard runs `check-file` and returns the violations | none |
| while iterating | `npx ddd-ts-kit check --changed-since <base>` and `npm test -- <context>` | seconds |
| before the commit that closes a slice | the two above, `npm run typecheck`, `npm run lint`, `npm run format:check` (`npm run format` settles it), `npx ddd-ts-kit todo <context>` (nothing left), `npx ddd-ts-kit check --commit-size` | under a minute |
| before a merge or a pull request | `npm run verify` | everything |

`npm run verify` chains types, lint, format, every spec with the coverage thresholds
(`npm run test:coverage`), end-to-end tests, the architecture rules, the import graph
(dependency-cruiser), dead code (knip) and documentation drift. Use
`npm run typecheck`, never `npx tsc`: the project compiles with the native compiler.
`npx ddd-ts-kit status` counts the `TODO(domain)`, `TODO(platform)` and `it.todo` left in
each context: a gate is not passed while the slice still has one.

## Coverage

`npm run test:coverage` fails with `Coverage for <rate> (<measured>%) does not meet
"<contexts>/<context>/<layer>/**/*.ts" threshold (<floor>%)`: that layer of that context holds
code no spec runs. The thresholds are the `coverage` key of `ddd-ts-kit.config.json` (the
reference when absent: domain 90/85/90/90, application 85/80/85/85, presentation 80/70/80/80,
infrastructure 70/60/70/70, as statements/branches/functions/lines).

- Read the uncovered lines in the report, write the spec of the behaviour that reaches them
  (`/ddd-ts-kit:testing`), or delete the code when nothing can reach it.
- Never add `exclude`, `include` or `thresholds` to the runner config, a `--coverage.*` flag to a
  script, or a `v8 ignore` / `istanbul ignore` comment: `test/coverage-governed` reports them.
- Lowering a threshold is a decision of the team: change the rate in the config and record it
  with `npx ddd-ts-kit generate adr "<title>" --deviation coverage.<layer>.<rate> --reason "<why>"`.
  Raising one is free.

## Read a violation

Each carries a rule id, a `file:line`, a message and a `fix` sentence. Open that file at that
line only. `npx ddd-ts-kit explain <rule-id>` gives the reason and a good and a bad example.

| Rule family | Usual root cause | Fix |
|---|---|---|
| `layer/*` | logic or a type in the wrong layer | move it, or a port in `application/ports/` and an adapter |
| `context/*` | a context reaching into another | a contract in the upstream's `published-language/`, an integration event, a declared relationship (skill `ddd-ts-kit:context-map`) |
| `tree/*`, `naming/*` | a file made by hand | `ddd-ts-kit generate`, then move the logic |
| `language/*` | a name outside the glossary | the business word, or the term added first (skill `ddd-ts-kit:glossary`) |
| `ports/*`, `declarations/*`, `composition/*` | wiring by hand | skill `ddd-ts-kit:wiring`; a stale barrel is `npx ddd-ts-kit docs` |
| `domain-events/*` | a handler or an adapter dispatching events itself; a `before-commit` handler depending on a gateway, an external port, `Cache`, `Lock`, `RateLimiter`, `JobScheduler` or `EventBus` | `await repository.save(aggregate)` and nothing else: the unit of work dispatches at its end; `phase: 'after-commit'` when the effect may be lost, an integration event when it must not |
| `authz/*` | a use case without a permission, a right decided in the wrong layer | skill `ddd-ts-kit:access-control` |
| `events/*`, `scheduling/*` | a contract outside the published language, a consumer without a name, a job doing work | skill `ddd-ts-kit:integration-event`; a job only sends a command |
| `purity/*`, `clean/*` | a hidden dependency, unclear code | skill `ddd-ts-kit:clean-code` |
| `aspects/*`, `tracing/*`, `standard/*` | a technical concern inside business code | skill `ddd-ts-kit:cross-cutting` |
| `governance/*`, `config/*` | a suppression or a config entry without its reason or record | skill `ddd-ts-kit:deviation` |
| `test/*` | behaviour without a test, or a mock | skill `ddd-ts-kit:testing` |
| documentation drift | generated files not regenerated | `npx ddd-ts-kit docs`, `npm run docs:generate`, commit them with the code |

Five ids are held by ESLint (`domain/*`, `application/*`): `npm run lint` reports them.

## Not without the owner's explicit agreement

A suppression, a lowered severity, a wider allow-list, an extra directory, a relaxed
pipeline, `any`, a non-null assertion, a skipped or deleted test: skill
`ddd-ts-kit:deviation`. Getting to green is never the reason.

## Report

The commands run and their real result, in a few lines. A failing gate is reported as
failing, with what remains and why.
