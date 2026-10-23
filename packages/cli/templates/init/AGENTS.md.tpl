# {{project.name}}

A ddd-ts-kit project: one bounded context per directory of `{{config.contextsDir}}/`, each described by its `CONTEXT.md`. The plan and what is next: `docs/architecture/plan.md`, when the project follows the method.

## Commands

- `npm run verify`: types, lint, format, tests with the coverage thresholds of `ddd-ts-kit.config.json` (per context and layer), architecture rules, import graph, dead code, documentation drift. Once, before a commit that closes a slice. A layer under its threshold gets the missing test, never an exclusion.
- `npx ddd-ts-kit check --changed-since <ref>`: the architecture rules on what changed; `npx ddd-ts-kit explain <rule-id>` gives the reason and an example.
- `npx ddd-ts-kit list --json`: the map of the contexts. `npx ddd-ts-kit describe <context> --json`: one context as data (use cases, routes, events, ports, dependencies).
- `npx ddd-ts-kit status`: the next step of the plan, the slices by status, the markers left per context. `npx ddd-ts-kit todo [<context>]`: each remaining `TODO(domain)` and `it.todo` as `file:line`.
- `npm run regenerate`: every derived file in one step, after a change of route, schema, event or config: `.dependency-cruiser.cjs`, then `npm run docs:generate`, which runs `npx ddd-ts-kit docs` (the context map, the barrels, the generated sections of each `CONTEXT.md`) and writes the OpenAPI contract, the forms and the event catalog.

## Read less

1. `describe <context> --json` and the `CONTEXT.md` of the context before the tree: do not browse `{{config.sourceRoot}}/` to learn what exists.
2. Open only what the `next` list of a generator (`file:line`) or a violation names.
3. `check --changed-since <ref>` and the tests of the context while iterating; `npm run verify` once at the end.

## Rules by layer

One file per layer in `.claude/rules/`: `domain.md` (`domain/`, the shared kernel), `application.md`, `published-language.md`, `infrastructure.md`, `presentation.md` (and the OpenAPI contract), `platform.md` (`{{config.platformDir}}/`, `main.ts`, `apps/`{{#if style.explicit}}, module files{{/if}}), `tests.md` (specs, fakes, builders, worlds, `test/`). The same text is in `.github/instructions/<layer>.instructions.md`. Claude Code and GitHub Copilot load it with the files it applies to; an agent that does not (Codex) reads the file of a layer before it edits a file of that layer.

## Generated files

Create every file of a role with `npx ddd-ts-kit generate <kind> ... --json`, then fill the `TODO(domain)` places it lists; never write one by hand, never restructure what a generator wrote.
{{#if assembly.barrel}}
Never edit `<context>.declarations.ts` nor the `<folder>.declarations.ts` of a role folder (`application/commands/commands.declarations.ts`): `generate`, `docs` and `npm run dev` rewrite them, from the role files and from the constructor signatures (each folder file registers what the constructors of its folder are injected; the one at the root re-exports them). After changing a constructor by hand, `npx ddd-ts-kit docs`.
{{/if}}
{{#if assembly.discovery}}
Never edit `<context>.dependencies.ts`: `generate`, `docs` and `npm run dev` rewrite it from the constructor signatures (it registers what each constructor is injected). After changing a constructor by hand, `npx ddd-ts-kit docs`.
{{/if}}
Never edit the contracts under `openapi/` (`openapi/openapi.yaml`, one file per document when `openapi.documents` splits it, the forms of `openapi/forms/`), `docs/integration/asyncapi.yaml`, `docs/integration/event-catalog.md`, `{{config.platformDir}}/http/openapi-documents.ts`, `.dependency-cruiser.cjs` or the generated sections of a `CONTEXT.md`: change the code or the config, then `npm run regenerate`. `stored-events.lock.json` is written by `npx ddd-ts-kit docs --stored-events` once the shape of a version is final (`docs --check` fails while one is unrecorded), never by hand: a stored shape changes only by a new version with its upcaster (`event-sourcing/upcaster-required`).
{{#if sdk.on}}
{{sdk.instruction}}
{{/if}}
Imports: a file of the project is imported by its alias from the project root, never by a relative path, the same directory included: `{{alias.source}}/...` for `{{config.sourceRoot}}/`, `{{alias.test}}/...` for `test/`, `{{alias.scripts}}/...` for `scripts/`, {{#if alias.extensionless}}never ending in `.js` or `.ts`, and naming a file, never a directory{{/if}}{{#unless alias.extensionless}}always ending in `.js`{{/unless}} (`imports/alias-only`, `imports/extension`; `npm run lint:fix` rewrites a relative import and a wrong ending). The alias is declared once, under `paths` in `tsconfig.json`, from `importAlias` of `ddd-ts-kit.config.json`, and the ending follows `importExtension`: never add a second entry or mapping, never change `module` or `moduleResolution` in `tsconfig.json`, and never compile without `npm run build`, which rewrites the aliases of `dist/` into relative paths ending in `.js` for Node (`imports/alias-declared`).
Everywhere: one exported class, interface or function per file, named after it in kebab-case; at most 350 lines a file, 30 lines and 3 parameters a function; `private` members, never `#name`; a blank line before a `return` and around `if`, `for`, `try` (`npm run lint:fix`); braces around the body of every `if`, `else`, `for`, `while` and `do`, on its own lines: a branch is visible at a glance, and a statement added to it later cannot silently fall outside it. `npm run format` (Biome, line width 120) lays out every file, then `npm run lint:fix` adds the blank lines a wrapped statement now needs: do not spend tokens on line breaks, and never run Prettier or a bare `npx biome`.

## Verifying your work

What each command prints when it passes; a line it does not print is a failure to read, never to work around. `npm run verify` prints no line of its own and exits 0 once every gate passed, stopping at the first that fails; its last gate, `docs:check`, ends with `The generated documentation is up to date.` then the build. `npm run typecheck`, `npm run lint` and `npm run deadcode` print nothing and exit 0. `npm run format:check`: `Checked N files in <time>. No fixes applied.` `npm run test:coverage`: {{#if tests.vitest}}`Test Files N passed (N)` and `Tests N passed (N)`{{/if}}{{#if tests.jest}}`Test Suites: N passed, N total` and `Tests: N passed, N total`{{/if}}, then the coverage table with nothing under its threshold. `npx ddd-ts-kit check --changed-since <ref>` and `npm run check:arch`: `0 errors, 0 warnings, 0 suppressions in N files.` `npm run depcruise`: `no dependency violations found (N modules, M dependencies cruised)`.{{#if http.any}} `npm run test:e2e`: {{#if tests.vitest}}`Test Files N passed (N)` (before the first spec, `No test files found, exiting with code 0`){{/if}}{{#if tests.jest}}`Test Suites: N passed, N total`{{/if}}; `npx ddd-ts-kit acceptance <story> --gate passing` ends with `gate passing: met`.{{/if}}
Run them before reporting a task done and paste their last lines. A failing check is fixed in the code, never in the check, the threshold or the test.

## Mistakes seen here

Owned by the team: a review finding or a `TODO(review)` made twice becomes one line here, or a rule of `ddd-ts-kit.config.json` when the kit has one. Keep it short, a stale line costs every session.
- none yet

## TypeScript

The compiler is the native TypeScript 7, installed as `@typescript/native`; `typescript` 6 is there for the tools that need its API (ESLint, dependency-cruiser). Use `npm run typecheck` and `npm run build`, never `npx tsc`, which would run version 6.

## Workflow

Follow the recommended steps in order, the supported path (`README.md`, "Recommended steps"): discover the domain, bounded contexts, glossaries, context map, bootstrap, plan the slices, build slice by slice, quality gate, document. `npx ddd-ts-kit status` says where the project stands. When asked to skip a step, say which one and what it costs, and record it in `docs/architecture/plan.md`.
With the ddd-ts-kit plugin: `/ddd-ts-kit:start` for a new project or to resume one, `/ddd-ts-kit:glossary` before a new name, `/ddd-ts-kit:use-case` for a feature, `/ddd-ts-kit:document` for the contracts, `/ddd-ts-kit:quality-gate` before a pull or merge request. The plugin installs in Claude Code, Codex and the Copilot CLI from the marketplace `gbourgeat/ddd-ts-kit`; Codex calls a skill by its name, `$start`, `$use-case`.
