**English** · [Français](quality-baseline.fr.md)

# Quality baseline

**Summary.** Every project the CLI generates, the example application and the kit itself carry
the same small set of tools, each answering one question, each behind one npm script. None is
optional and none overlaps another: the type checker does not lint, the linter does not format,
the formatter does not lint. This page lists them with their commands; the comparison of the
architecture analyzers is in [Static analysis and the pipeline](static-analysis-and-pipeline.md).

## What each tool answers

| Tool | The question it answers | Script | Settles it |
|---|---|---|---|
| TypeScript, `strict` | is it sound: does every value have the type the code says | `npm run typecheck` | the compiler error |
| ESLint with `@ddd-ts-kit/eslint-plugin` | is it idiomatic and within the rules: layers, purity, clean code, braces, blank lines | `npm run lint` | `npm run lint:fix` for what is fixable |
| Biome, as a formatter only | is it laid out the one way: line width 120, quotes, commas, line breaks | `npm run format:check` | `npm run format` |
| knip | is anything dead: a file, an export, a dependency nobody uses | `npm run deadcode` | removing it |
| dependency-cruiser | does the import graph respect the boundaries, through barrels and re-exports | `npm run depcruise` | moving the import |
| `ddd-ts-kit check` | is the architecture intact: the tree, the names, the glossary, the rules of the reference | `npm run check:arch` | the `fix` sentence of each finding |
| the test runner | does it work | `npm test`, `npm run test:e2e` | the code |
| the coverage of the test runner | is there code no spec has ever run, layer by layer | `npm run test:coverage` | the missing spec |

`npm run verify` chains them all, in that order: types, lint, format, every spec with the
coverage thresholds, end-to-end specs, architecture, graph, dead code, generated documents. The
pipeline runs the same scripts under their `ci:*` names, on GitHub Actions and on GitLab CI.
The list is written once, in the CLI (`BASELINE`, `packages/cli/src/init/manifest/baseline.ts`):
`verify` is built from it and a test of the CLI holds the two pipelines, for several stacks and
for the example application, to every gate of it, so a gate cannot leave one place silently.

![Two sources written once: the list BASELINE of the CLI, from which the verify script is built and to which a test holds the GitHub and GitLab pipelines; and biome.json at the root of the kit, which the template of the CLI copies under a test, byte for byte but for one exclusion of the kit, and which the example extends](../assets/diagrams/quality-baseline-one-source.svg)

In a generated project and in the example application, `verify` is that list, in that order:

```json
{
  "scripts": {
    "verify": "npm run typecheck && npm run lint && npm run format:check && npm run test:coverage && npm run test:e2e && npm run check:arch && npm run depcruise && npm run deadcode && npm run docs:check"
  }
}
```

### One file, one question per tool

Each tool sees something the others do not. This file of a domain breaks one thing for each of
them:

```ts
// src/contexts/billing/domain/services/invoice-total.ts
import type { InvoiceRow } from '@/contexts/billing/infrastructure/persistence/billing.schema';

export function totalOf(rows: readonly InvoiceRow[]): number {
  const amounts = rows.map((row) => row.amount_in_cents)
  if (amounts.length === 0) return 0;
  return amounts.reduce((sum, amount) => sum + amount, "0");
}

export function formatTotal(totalInCents: number): string {
  return `${totalInCents / 100} EUR`;
}
```

| Tool | What it reports in that file |
|---|---|
| TypeScript | `reduce` started with a string returns a `string`, where the function promises a `number` |
| ESLint | `layer/domain-purity`: the domain imports a row of infrastructure; `clean/braces`: the `if` has no braces; `clean/blank-lines`: no blank line after the declaration, around the `if`, before the `return` |
| Biome | the missing semicolon and the double quotes (`npm run format` rewrites them) |
| knip | `formatTotal` is exported and nobody imports it |
| dependency-cruiser | the import from `domain/` into `infrastructure/`, also when it goes through a barrel or a re-export |
| `ddd-ts-kit check` | the same layer rule, read from the tree and the text of the file, and the rest of the reference (names, glossary) |
| the specs and their coverage | whether `totalOf` was run at all, and whether the domain of `billing` stays above its threshold |

The same file once every gate passes:

<!-- checked sample -->
```ts
// src/contexts/billing/domain/services/invoice-total.ts
export interface InvoiceLine {
  readonly amountInCents: number;
}

export function totalOf(lines: readonly InvoiceLine[]): number {
  const amounts = lines.map((line) => line.amountInCents);

  if (amounts.length === 0) {
    return 0;
  }

  return amounts.reduce((sum, amount) => sum + amount, 0);
}
```

The domain now names its own line instead of a row, and the mapping from the row stays in
`infrastructure/`.

## Where each gate runs

Read from the files on 2026-10-13. "kit" is this repository, "example" is
`examples/scheduling`, "project" is what `init` generates, on every stack. The cheapest gates run
first and on what changed; the wider ones run later, on every file:

![Five moments from left to right: at every write the editor hook runs ddd-ts-kit check on the file; at a commit lefthook runs ESLint, the formatter and ddd-ts-kit check on the staged files, the commit size and commitlint; at a push the type check and the unit specs; npm run verify chains the nine gates; the pipeline runs them under their ci names, with the production build](../assets/diagrams/quality-baseline-when-gates-run.svg)

| Gate | `verify` | GitHub and GitLab pipeline | Hooks |
|---|---|---|---|
| type check, sources | kit `ci:typecheck` (the build, then the checked samples of the documentation); example and project `typecheck` | kit, example, project: `ci:typecheck` | before a push |
| type check, tests | kit `typecheck:tests` (every package, through `ci:typecheck`); example and project: `tsconfig.json` includes `test/` and the specs | same script | before a push |
| lint | kit `ci:lint`; example and project `lint`, each with the cache of ESLint keyed by content, dropped when the rules as installed or the config changed | `ci:lint`, the cache written by the default branch and restored by a pull request | staged files, before a commit |
| format | kit `ci:format`; example and project `format:check` | `ci:format`, in the lint job | staged files, before a commit |
| dead code | kit `ci:deadcode`; example and project `deadcode` | `ci:deadcode` | no |
| dependency graph | kit `depcruise` (in `ci:arch`); example and project `depcruise` | kit `ci:arch`; example and project `ci:arch:graph` | no |
| architecture | kit `check:self`, the fixtures of every rule, and the tests of the hooks of the plugin, held to 100 percent of their lines, branches and functions (`test:plugin`, in `ci:arch`); example and project `check:arch` | kit `ci:arch`; example and project `ci:arch:check` | project and example: staged files, before a commit; at every write through the editor hook |
| families at parity | kit `check:parity`: the four ORM, the brokers and the loggers offer the same options and run their contracts with the same capabilities, or `pipeline/monorepo/families.mjs` says why not (in `ci:arch`) | kit `ci:arch` | no |
| migrations on a real PostgreSQL | kit `ci:test:migrations`: a project with an audit trail on each of the four ORM, installed for real, runs the database lines of its README as written from an empty database (`DATABASE_URL` in `.env` alone, the audit guard added), brings a second table with `db:generate` and `db:migrate`, builds a fresh database from the migrations alone and passes every gate | the `migrations` job at night, on demand and on the pull request of a release, and the release | no |
| pairs of capability values | kit `ci:test:pairwise`: stacks chosen to meet each value of a capability flag with each value of every other one that `init` accepts (`test/support/pairwise.ts`), generated whole and type-checked; the unit run proves that the pairs are all met | the `pairwise` job at night and on the pull request of a release, and the release | no |
| support matrix of the generator | kit `support-matrix.spec.ts` of the CLI: every refusal of `init` and of the presets over every pair of flags, and the platform todos and packages of the kit of each member of a family of flags, declared `decided` or `not yet` | `ci:test:unit` | before a push |
| every rule proven on the example | kit: `example:verify` runs `example:conformance` after the example's own gate | kit: the `example` job | no |
| documents drift | kit `ci:docs` (no em dash or en dash, every French page in step with its English page); example and project `docs:check` | `ci:docs` | kit: the dash check (`check:dashes`), before a commit |
| mutation score | kit: the example's `test:mutation` (the `mutation` job of the night); example and project `test:mutation` | the `mutation` job when the schedule fires, and `mutation-changed` on a pull request, a reading of the survivors of the change | no |
| unit specs | kit `ci:test:unit`; example and project `test:coverage` | `ci:test:unit` | before a push, on what the branch reaches: for the kit the packages and the packages built on them (`affected-packages.mjs --base origin/main --run test`, without coverage), for the example and a project the contexts (`ddd-ts-kit affected --run`) |
| integration specs | kit: the pipeline only (they need servers); example and project `test:coverage` (PostgreSQL in process) | `ci:test:integration` | no |
| end-to-end specs | kit: the pipeline only (`ci:test:e2e`, every stack generated and run; at night, the Prisma and TypeORM stacks installed for real from the packed kit and held to their `verify`, the contracts of the platform stores included); example and project `test:e2e` | `ci:test:e2e`, the `managers` job at night | no |
| coverage thresholds | kit: a floor per package in `vitest.config.ts`, in `ci:test:unit`; example and project: per context and layer, from `ddd-ts-kit.config.json`, in `test:coverage` | `ci:test:unit` and, for the example and a project, `ci:test:integration` | example and project: before a push (the unit run); kit: the pipeline only |
| packages as published | kit `ci:build` (publint, Are the Types Wrong) | kit `ci:build`; example and project `ci:build` (the production build) | no |
| secrets | no: not a gate of `verify` | the `secrets` job (gitleaks on the whole history) | kit, example and project: the staged changes, before a commit, when the `gitleaks` binary is on the path; one line and no refusal otherwise |

Without an HTTP boundary a project has no end-to-end script and its pipeline job says so; under
jest the adapter specs run with the unit specs. The hooks never run coverage before a commit.

## Warnings fail the lint

In a generated project and in the example application, `lint` and `ci:lint` run
`ddd-ts-kit lint`, the ESLint of the project (its patterns, `--format` and `--fix` as ESLint
takes them): one warning fails `npm run lint`, `verify` and the lint job of the pipeline, as an
error does. The preset keeps its warnings as warnings (such as `complexity`,
`max-depth`, `clean/function-size`, `clean/no-flag-argument`, `clean/no-noise-comment`, `any`
and the non-null assertion in a spec): the editor and the report still tell a judgement call
from a broken rule, and neither is left behind. A new project has none, and `init` writes no
suppressions file: the first warning is seen the day it is written.

**A rule a later version adds**, or what a rule judges more, has no exception: it lands at its
severity, an error for a rule that prevents a problem, and its warnings fail the lint as the others
do ([CONTRIBUTING.md](../../CONTRIBUTING.md)). The CHANGELOG of the version that brings it names
the rule with a `To move:` line, and `ddd-ts-kit check --rule <id>` lists the files to take up
before the upgrade. The hook before a commit runs ESLint on the staged files without the limit,
so it shows a warning without stopping the commit; `verify` and the pipeline stop it.

A project made by an earlier version keeps its own scripts: `init` adds a script a project
lacks and leaves one it has, with a note naming what the kit expects, and `npx ddd-ts-kit
doctor` lists `lint` and `ci:lint` as written otherwise, which `doctor --strict` does not fail
on. Its lint stays as it was until it takes the new scripts: `npx ddd-ts-kit init --force`
(which writes every file and script of the kit over the project's), or the two scripts
set by hand to `ddd-ts-kit lint`. Before that, it settles each rule that warns, one of two
ways:

1. **Fix the warnings.** `npx eslint .` lists them.
2. **Record them.** An ESLint bulk suppression records errors only (`--suppress-all` writes
   nothing for a warning), so the rule is raised to `error` first, then what exists is
   recorded:
   - a rule of the kit through its id in the `rules` key of `ddd-ts-kit.config.json`
     ([CONFIG.md](../CONFIG.md)), `"clean/function-size": "error"`, read by `ddd-ts-kit check`
     and by the preset; raising a severity needs no decision record;
   - a standard rule of the preset in `eslint.config.mjs`, after the preset: a severity alone
     keeps the options of the preset. `complexity` is off in the specs: its block names them in
     `ignores` (`'**/*.spec.ts'`, `'**/*.test.ts'`, `'**/test/**'`).

```js
import { dddTsKit } from '@ddd-ts-kit/eslint-plugin';

export default [
  ...dddTsKit({ tsconfigRootDir: import.meta.dirname }),
  { files: ['**/*.ts'], rules: { 'max-depth': 'error' } },
];
```

```bash
npx eslint . --suppress-rule max-depth      # one rule; --suppress-all records every rule at error
npx eslint . --prune-suppressions           # after a recorded finding is fixed
```

`--suppress-rule` writes `eslint-suppressions.json` at the root of the project, committed with
the change of severity: for each file, each rule and the count of its findings. From then on
`npm run lint` fails on a finding beyond the recorded count, of any rule, and on an entry that
no longer occurs, until `--prune-suppressions` removes it: the file only shrinks. A run that
leaves contexts out (`--ignore-pattern`, on a pull request) does not judge the entries of the
files it skips. Adding an entry to get to green is a suppression like an inline one: the
project owner decides it ([Deviations](../CONFIG.md#deviations)).

## Coverage

The thresholds are a setting of the project, not of the test runner: the `coverage` key of
`ddd-ts-kit.config.json`, per layer, with the reference as default, applied to each context
([CONFIG.md](../CONFIG.md#coverage-thresholds)). The runner config reads it; lowering a rate is
a recorded deviation; `test/coverage-governed` refuses an exclusion written beside it. What a
rate proves and what it does not: [Testing strategy](../concepts/testing-strategy.md#coverage-thresholds).
The kit holds itself to a floor per package, the level measured when the floor was written.

## The formatter

Biome is used for one thing: `biome.json`, written by `ddd-ts-kit init`, enables its formatter
and switches its linter and its import organiser off. ESLint stays the only linter, and no
import is ever reordered by a tool. The settings are the same in the kit, in the example and
in every generated project: line width 120, two spaces, LF, single quotes, trailing commas,
semicolons, parentheses around the parameter of an arrow function.

- Formatted: `.ts`, `.mts`, `.cts`, `.js`, `.mjs`, `.cjs`, `.json`, `.jsonc`.
- Not formatted: Markdown (a formatter would rewrap tables and prose) and YAML.
- Left out in `biome.json`: build outputs (`dist`, `coverage`, `reports`), the lockfile, a
  `generated` directory, the snapshots of the migrations (`migrations/meta`), the state the
  guard and the workers keep in `.ddd-ts-kit/` (git-ignored, and written on one line), and the
  artifacts their own check compares byte for byte (`openapi/*.json` and `asyncapi.json` under
  `openapi.format: json`, the forms of `openapi/forms/`, `.dependency-cruiser.cjs`); the YAML
  contracts are not formatted anyway. One more line appears only where it applies: the sources of
  a generated client (`clients/*/src`), which `ddd-ts-kit sdk` adds to a project that asks for
  clients. In the kit, `.ddd-ts-kit` also holds the compiled samples of its documentation.

What the CLI writes is already formatted: `npm run format:check` passes right after `init` and
after every `generate`, and the end-to-end suite of the CLI holds that for every stack it
builds. The generator has no formatter of its own: the templates are written the way the
formatter prints them, with layouts that do not depend on the length of a name where that is
possible, so a very long name can still leave one line for `npm run format` to wrap.

ESLint and the formatter never fight, because they decide different things. The presets of the
plugin enable no rule about where a token goes; they keep the two things a formatter does not
decide: the blank lines between statements (`clean/blank-lines`) and the braces of a branch
(`clean/braces`). Run in either order, the second tool finds nothing to change once the first round is
over. `packages/eslint-plugin/test/presets/padding-and-biome.spec.ts` holds that agreement on a corpus of
spec-shaped files.

```ts
// instead of: the formatter keeps both lines as they are, since neither breaks its layout
if (wrapped.has(repository)) return repository;
const next = steps.shift();

// write: lint --fix adds the braces and the blank line, then the formatter breaks the block
if (wrapped.has(repository)) {
  return repository;
}

const next = steps.shift();
```

## One configuration, three places

`biome.json` at the root of the kit is the source. The template the CLI copies into a project
is compared with it byte for byte by a test of the CLI, but for the line a new project does
not need: the one that leaves out the generated client of the example (`ddd-ts-kit sdk` adds it
to a project that asks for clients). The example application extends it instead of copying it, so the three cannot drift
(the right half of the drawing at the top of this page):

```json
{
  "$schema": "https://biomejs.dev/schemas/2.6.2/schema.json",
  "root": false,
  "extends": "//"
}
```
