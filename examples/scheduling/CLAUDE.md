# scheduling

A ddd-ts-kit project: one bounded context per directory of `src/contexts/`, each described by its `CONTEXT.md`. The plan and what is next: `docs/architecture/plan.md`, when the project follows the method.

## Commands

- `npm run verify`: types, lint, format, tests, architecture rules, import graph, dead code, documentation drift. Once, before a commit that closes a slice.
- `npx ddd-ts-kit check --changed-since <ref>`: the architecture rules on what changed; `npx ddd-ts-kit explain <rule-id>` gives the reason and an example.
- `npx ddd-ts-kit list --json`: the map of the contexts. `npx ddd-ts-kit describe <context> --json`: one context as data (use cases, routes, events, ports, dependencies).
- `npx ddd-ts-kit status`: the next step of the plan, the slices by status, the markers left per context. `npx ddd-ts-kit todo [<context>]`: each remaining `TODO(domain)` and `it.todo` as `file:line`.
- `npx ddd-ts-kit docs`: regenerates the context map and the generated sections of each `CONTEXT.md`; `npm run docs:generate` the OpenAPI contract and the event catalog.

## Read less

1. `describe <context> --json` and the `CONTEXT.md` of the context before the tree: do not browse `src/` to learn what exists.
2. Open only what the `next` list of a generator (`file:line`) or a violation names.
3. `check --changed-since <ref>` and the tests of the context while iterating; `npm run verify` once at the end.

## Rules by layer

Loaded with the files they apply to, from `.claude/rules/`: `domain.md` (`domain/`, the shared kernel), `application.md`, `published-language.md`, `infrastructure.md`, `presentation.md` (and the OpenAPI contract), `platform.md` (`src/platform/`, `main.ts`, `apps/`), `tests.md` (specs, fakes, builders, `test/`).

## Generated files

Create every file of a role with `npx ddd-ts-kit generate <kind> ... --json`, then fill the `TODO(domain)` places it lists; never write one by hand, never restructure what a generator wrote.
Never edit `<context>.declarations.ts`: `generate` and `docs` rewrite it.
Never edit `openapi/openapi.json`, `docs/integration/asyncapi.json`, `docs/integration/event-catalog.md`, `.dependency-cruiser.cjs` or the generated sections of a `CONTEXT.md`: change the code or the config, then `npm run docs:generate`, `npx ddd-ts-kit docs` and `npx ddd-ts-kit depcruise-config --write`.
Imports: a file of the project is imported by its alias from the project root, never by a relative path, the same directory included: `#src/...` for `src/`, `#test/...` for `test/`, `#scripts/...` for `scripts/`, always ending in `.js` (`imports/alias-only`; `npm run lint:fix` rewrites a relative import). The alias is declared once, under `imports` in `package.json`: never add a `paths` entry or a second mapping (`imports/alias-declared`).
Everywhere: one exported class, interface or function per file, named after it in kebab-case; at most 350 lines a file, 30 lines and 3 parameters a function; `private` members, never `#name`; a blank line before a `return` and around `if`, `for`, `try` (`npm run lint:fix`); braces around the body of every `if`, `else`, `for`, `while` and `do`, on its own lines: a branch is visible at a glance, and a statement added to it later cannot silently fall outside it. `npm run format` (Biome, line width 120) lays out every file: do not spend tokens on line breaks.

## TypeScript

The compiler is the native TypeScript 7, installed as `@typescript/native`; `typescript` 6 is there for the tools that need its API (ESLint, dependency-cruiser). Use `npm run typecheck` and `npm run build`, never `npx tsc`, which would run version 6.

## Workflow

With the ddd-ts-kit plugin: `/ddd-ts-kit:start` for a new project or to resume one, `/ddd-ts-kit:glossary` before a new name, `/ddd-ts-kit:use-case` for a feature, `/ddd-ts-kit:document` for the contracts, `/ddd-ts-kit:quality-gate` before a pull or merge request.
