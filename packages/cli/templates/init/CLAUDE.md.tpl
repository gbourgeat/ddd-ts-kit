# {{project.name}}

A ddd-ts-kit project: one bounded context per directory of `{{config.contextsDir}}/`, each described by its `CONTEXT.md`.

## Commands

- `npm run verify`: types, lint, tests, architecture rules, import graph, dead code, documentation drift. Run it before calling work done.
- `npx ddd-ts-kit check`: the architecture rules; `npx ddd-ts-kit explain <rule-id>` gives the reason and an example.
- `npx ddd-ts-kit list --json`: the map (contexts, glossaries, aggregates, use cases, builders).
- `npx ddd-ts-kit docs`: regenerates the context map and the generated lists of each `CONTEXT.md`.

## Rules by layer

Loaded with the files they apply to:

- `.claude/rules/domain.md`: `domain/` and the shared kernel
- `.claude/rules/application.md`: `application/` and `published-language/`
- `.claude/rules/infrastructure.md`: `infrastructure/`, module files, `{{config.platformDir}}/`, `main.ts`
- `.claude/rules/presentation.md`: `presentation/`, the OpenAPI contract
- `.claude/rules/tests.md`: specs, fakes, builders

## Generated files

Never edit `openapi/openapi.json`, `docs/integration/asyncapi.json`, `docs/integration/event-catalog.md` or `.dependency-cruiser.cjs`: change the code or the config, then run `npm run docs:generate` (and `npx ddd-ts-kit depcruise-config --write`).

## TypeScript

The compiler is the native TypeScript 7, installed as `@typescript/native`; `typescript` 6 is there for the tools that need its API (ESLint, dependency-cruiser). Use `npm run typecheck` and `npm run build`, never `npx tsc`, which would run version 6.

## Workflow

With the ddd-ts-kit plugin: `/ddd-ts-kit:model-context` (glossary and model first), then `/ddd-ts-kit:use-case`.
Before a pull or merge request: `/ddd-ts-kit:quality-gate`.
