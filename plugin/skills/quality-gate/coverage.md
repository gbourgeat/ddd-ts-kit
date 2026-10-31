# Coverage

Read when `npm run test:coverage` fails on a threshold.

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
