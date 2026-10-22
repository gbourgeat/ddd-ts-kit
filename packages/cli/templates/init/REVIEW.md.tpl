# Review instructions

The policy every review of this project applies: the `architecture-reviewer` agent reads it on top of its method, a human reviewer and any review bot read the same file. Owned by the team: edit it, keep it short. Written once by `ddd-ts-kit init`, never rewritten.

## Passes

Tag each finding with its pass.

- Bugs: a wrong business rule, a state the aggregate can reach that it should not, an idempotent replay that is not, a failure path without a test.
- Security: a search not narrowed by the access scope, a field reserved to a permission that leaks in a representation, personal data in a log or an error, an error code not declared on its route, a tenant read outside the scope.
- Compliance: the diff against the design review of its row (`docs/architecture/reviews/<story>.md`), the acceptance scenarios of its story (`test/acceptance/`), the records of `docs/adr/`, and the rules (`npx ddd-ts-kit check --changed-since <base> --explain`).

## What Important means here

A violation of a rule of the kit, wrong behaviour, a broken boundary, a leak of data, an acceptance scenario changed outside a verdict. Naming and layout are nits unless a rule holds them.

## Cap the nits

At most five nits per review; the rest as a count. A nit that recurs becomes a line of `AGENTS.md` under `## Mistakes seen here`, or a rule of `ddd-ts-kit.config.json` when the kit has one.

## Do not report

Generated files (the barrels, `openapi/`, `docs/integration/asyncapi.yaml` and `docs/integration/event-catalog.md`, `{{config.platformDir}}/http/openapi-documents.ts`, `.dependency-cruiser.cjs`, the generated sections of each `CONTEXT.md`) and anything `npm run verify` already refuses.
