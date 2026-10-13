# {{project.name}}

A ddd-ts-kit project: one bounded context per directory of `{{config.contextsDir}}/`, each described by its `CONTEXT.md`. The plan and what is next: `docs/architecture/plan.md`, when the project follows the method.

## Commands

- `npm run verify`: types, lint, format, tests with the coverage thresholds of `ddd-ts-kit.config.json` (per context and layer), architecture rules, import graph, dead code, documentation drift. Once, before a commit that closes a slice. A layer under its threshold gets the missing test, never an exclusion.
- `npx ddd-ts-kit check --changed-since <ref>`: the architecture rules on what changed; `npx ddd-ts-kit explain <rule-id>` gives the reason and an example.
- `npx ddd-ts-kit list --json`: the map of the contexts. `npx ddd-ts-kit describe <context> --json`: one context as data (use cases, routes, events, ports, dependencies).
- `npx ddd-ts-kit status`: the next step of the plan, the slices by status, the markers left per context. `npx ddd-ts-kit todo [<context>]`: each remaining `TODO(domain)` and `it.todo` as `file:line`.
- `npx ddd-ts-kit docs`: regenerates the context map and the generated sections of each `CONTEXT.md`; `npm run docs:generate` the OpenAPI contract and the event catalog.

## Read less

1. `describe <context> --json` and the `CONTEXT.md` of the context before the tree: do not browse `{{config.sourceRoot}}/` to learn what exists.
2. Open only what the `next` list of a generator (`file:line`) or a violation names.
3. `check --changed-since <ref>` and the tests of the context while iterating; `npm run verify` once at the end.

## Rules by layer

Loaded with the files they apply to, from `.claude/rules/`: `domain.md` (`domain/`, the shared kernel), `application.md`, `published-language.md`, `infrastructure.md`, `presentation.md` (and the OpenAPI contract), `platform.md` (`{{config.platformDir}}/`, `main.ts`, `apps/`{{#if style.explicit}}, module files{{/if}}), `tests.md` (specs, fakes, builders, `test/`).

## Generated files

Create every file of a role with `npx ddd-ts-kit generate <kind> ... --json`, then fill the `TODO(domain)` places it lists; never write one by hand, never restructure what a generator wrote.
{{#if assembly.barrel}}
Never edit `<context>.declarations.ts`: `generate`, `docs` and `npm run dev` rewrite it, from the role files and from the constructor signatures (it registers what each constructor is injected). After changing a constructor by hand, `npx ddd-ts-kit docs`.
{{/if}}
{{#if assembly.discovery}}
Never edit `<context>.dependencies.ts`: `generate`, `docs` and `npm run dev` rewrite it from the constructor signatures (it registers what each constructor is injected). After changing a constructor by hand, `npx ddd-ts-kit docs`.
{{/if}}
Never edit the contracts under `openapi/` (`openapi/openapi.yaml`, one file per document when `openapi.documents` splits it), `docs/integration/asyncapi.yaml`, `docs/integration/event-catalog.md`, `{{config.platformDir}}/http/openapi-documents.ts`, `.dependency-cruiser.cjs` or the generated sections of a `CONTEXT.md`: change the code or the config, then `npm run docs:generate`, `npx ddd-ts-kit docs` and `npx ddd-ts-kit depcruise-config --write`.
{{#if sdk.on}}
{{sdk.instruction}}
{{/if}}
Imports: a file of the project is imported by its alias from the project root, never by a relative path, the same directory included: `{{alias.source}}/...` for `{{config.sourceRoot}}/`, `{{alias.test}}/...` for `test/`, `{{alias.scripts}}/...` for `scripts/`, {{#if alias.extensionless}}never ending in `.js` or `.ts`, and naming a file, never a directory{{/if}}{{#unless alias.extensionless}}always ending in `.js`{{/unless}} (`imports/alias-only`, `imports/extension`; `npm run lint:fix` rewrites a relative import and a wrong ending). The alias is declared once, under `paths` in `tsconfig.json`, from `importAlias` of `ddd-ts-kit.config.json`, and the ending follows `importExtension`: never add a second entry or mapping, never change `module` or `moduleResolution` in `tsconfig.json`, and never compile without `npm run build`, which rewrites the aliases of `dist/` into relative paths ending in `.js` for Node (`imports/alias-declared`).
Everywhere: one exported class, interface or function per file, named after it in kebab-case; at most 350 lines a file, 30 lines and 3 parameters a function; `private` members, never `#name`; a blank line before a `return` and around `if`, `for`, `try` (`npm run lint:fix`); braces around the body of every `if`, `else`, `for`, `while` and `do`, on its own lines: a branch is visible at a glance, and a statement added to it later cannot silently fall outside it. `npm run format` (Biome, line width 120) lays out every file: do not spend tokens on line breaks.

## TypeScript

The compiler is the native TypeScript 7, installed as `@typescript/native`; `typescript` 6 is there for the tools that need its API (ESLint, dependency-cruiser). Use `npm run typecheck` and `npm run build`, never `npx tsc`, which would run version 6.

## Workflow

Follow the recommended steps in order, the supported path (`README.md`, "Recommended steps"): discover the domain, bounded contexts, glossaries, context map, bootstrap, plan the slices, build slice by slice, quality gate, document. `npx ddd-ts-kit status` says where the project stands. When asked to skip a step, say which one and what it costs, and record it in `docs/architecture/plan.md`.
With the ddd-ts-kit plugin: `/ddd-ts-kit:start` for a new project or to resume one, `/ddd-ts-kit:glossary` before a new name, `/ddd-ts-kit:use-case` for a feature, `/ddd-ts-kit:document` for the contracts, `/ddd-ts-kit:quality-gate` before a pull or merge request.
