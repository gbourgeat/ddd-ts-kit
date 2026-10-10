# Import aliases: tsconfig `paths`, rewritten at build

**Summary.** A project built with the kit imports its own files by an alias, never by a
relative path: `@/contexts/billing/domain/aggregates/invoice.aggregate.js` instead of
`../../../domain/aggregates/invoice.aggregate.js`. The alias of the source root is `@/`. It is
declared once, under `paths` in `tsconfig.json`, which the compiler, the dev runner, the test
runner, knip and dependency-cruiser read. Node reads no `tsconfig.json`, so the build has a
second step: `ddd-ts-kit build-aliases` rewrites every alias of the compiled output into a
relative path, and production runs with plain `node dist/src/main.js`, without a loader, a flag
or a runtime dependency. Two rules hold it: `imports/alias-only` (every import uses the alias,
ESLint fixes it) and `imports/alias-declared` (the declaration, everything that has to follow
it, and the build step agree).

## What is being decided

An alias is declared somewhere and then resolved by many tools: the type checker, the build,
`node` in production, the dev runner, the test runner, ESLint, `ddd-ts-kit check`,
dependency-cruiser, knip. If two of them resolve it differently, nothing fails where the
mistake is made: the type check passes on one file while production loads another, or a
boundary rule stops seeing an import. So the decision is less "which prefix" than "which
mechanism lets every tool follow one declaration".

## Why `@/` cannot be a Node subpath import

Node resolves one kind of alias by itself: a subpath import, declared under the `imports` field
of `package.json`. Its specifier has to start with `#`: that is how Node tells it from a
package. `@/x.js` starts with `@`, so Node reads it as a package of an empty scope and fails
(`ERR_MODULE_NOT_FOUND`, "Cannot find package"). A project that wants `@/` therefore declares
it for the compiler and removes it before Node sees it.

| | tsconfig `paths` (`@/`) and a rewrite at build | Node subpath imports (`#name/`) | tsconfig `paths` and a runtime resolver |
|---|---|---|---|
| Spelling | free: `@/` | `#`, then a name (Node 22 refuses a bare `#` and a slash) | free |
| Declared in | `tsconfig.json` | `package.json` | `tsconfig.json` |
| Plain `node dist/src/main.js` | yes, once the build rewrote the emitted specifiers | yes, natively | no: a loader or a `require` hook in production |
| Type check, tsx, vitest, knip, drizzle-kit | read `paths` | read `package.json`; each source-reading tool needs a resolution condition, or it loads `dist/` | read `paths` |
| dependency-cruiser | reads `paths` through its `tsConfig` option | reads `package.json` under a condition | reads `paths` |
| jest | `moduleNameMapper`, a second declaration | reads `package.json` under a condition | `moduleNameMapper` |
| What can drift | a repeated mapping (jest), a tool no longer told to read tsconfig, a build without the rewrite | the condition of each source-reading tool | every repeated mapping, and a start command without the loader |
| A stale `dist/` loaded by a dev tool | impossible: `paths` only names sources | possible when a condition is forgotten | impossible |

The kit takes the first column. The rewrite is a command of the kit, not a third-party package.

## The declaration

A person edits one thing: `importAlias` in `ddd-ts-kit.config.json` (`@/` by default). `init`
writes the declaration from it:

```json
"paths": {
  "@/*": ["./src/*"],
  "$test/*": ["./test/*"],
  "$scripts/*": ["./scripts/*"]
}
```

| Alias | Directory | Notes |
|---|---|---|
| `importAlias`, `@/` by default | `sourceRoot` | the only one the config renames |
| `$test/` | `test/` | not part of the build: the compiler only emits a file of it when a shipped source imports it |
| `$scripts/` | `scripts/` | built with the sources (`dist/scripts`) |
| `$generated/` | `generated/` | with `stack.orm` `prisma` only: the client Prisma generates |

`tsconfig.build.json` extends `tsconfig.json` and declares no `paths` of its own.

### Why `$test/` and not `@test/`

`@test/x` is also the name a package may bear on the registry (scope `test`). The risk was
measured: with a package placed at `node_modules/@test/decoy` and a file of the project at
`test/decoy/where.ts`, the compiler, tsx and vitest answered the file of the project, and
dependency-cruiser answered the package. It tries the specifier as written first (`where.js`,
which only exists in the package) and falls back to the TypeScript source only when nothing
was found. A guard on `package.json` cannot repair a tool that reads another file, so the kit
takes spellings that cannot be a package name at all:

- `@/`: a scope has a name, an empty one names no package;
- `$<name>/`: `$` is not allowed in a package name. The registry accepts only names equal to
  their URL encoding; `validate-npm-package-name` answers "name can only contain URL-friendly
  characters" for `$test`, for new and for old packages.

SvelteKit spells its own aliases the same way (`$lib`, `$app`). `importAlias` accepts the two
forms: `@/`, or `$`, one name in lower case (letters, digits, hyphens) and `/`. `init` and
`check` refuse the rest and say why: `#name/` (a Node subpath import, another mechanism),
`@name/` (the name of a scope), `name/` or `~/` (possible package names), and `$test/`,
`$scripts/`, `$generated/` (already taken).

## What each tool reads

| Tool | What it reads | What the kit writes for it |
|---|---|---|
| TypeScript 6 and 7 (type check, build, the editor) | `paths` of `tsconfig.json` | the entries above |
| `ddd-ts-kit build-aliases` (second step of `npm run build`) | `importAlias` and `sourceRoot` of the config, `rootDir` and `outDir` of `tsconfig.build.json` | the `build` script chains it after the compiler |
| `node` (production, `npm start`, the Docker image) | nothing: the output holds relative paths only | nothing |
| tsx (`npm run dev`) | `paths`, by itself, also for a file loaded with `--import` | nothing: the script has no flag for it |
| vitest | `paths`, once told to | `resolve: { tsconfigPaths: true }` in its configs (native to vite 8, no plugin) |
| jest | nothing of tsconfig | `moduleNameMapper`, the same entries: `'^@/(.*)\\.js$': '<rootDir>/src/$1.ts'` |
| dependency-cruiser | `paths`, once told to | `tsConfig: { fileName: 'tsconfig.json' }` in the generated `.dependency-cruiser.cjs` |
| knip | `paths`, by itself | nothing |
| drizzle-kit (`npm run db:generate`) | `paths`, by itself, when it loads the TypeScript schema | nothing: the script is plain `drizzle-kit generate` |
| knex and TypeORM CLIs | the compiled output (`npm run build` first) | a knex migration is a JavaScript file at the project root: it names the compiled schema by its relative path under `dist/` |
| Prisma CLI | `prisma.config.ts`, which imports no file of the project | nothing |
| ESLint with `@ddd-ts-kit/eslint-plugin`, `ddd-ts-kit check` | `importAlias` and `sourceRoot` of the config | they classify an import by its path and never load a file |
| Biome | nothing | it formats; a fixed import that passes the line width is wrapped by `npm run format` |

## The build step

```
npm run build   =   tsc -p tsconfig.build.json && ddd-ts-kit build-aliases
```

`ddd-ts-kit build-aliases [--project <tsconfig>]` (default `tsconfig.build.json`) reads the
output directory of that tsconfig and, in every `.js`, `.mjs`, `.cjs`, `.d.ts`, `.d.mts` and
`.d.cts` under it, turns each alias specifier into the relative path of the emitted file it
names, with its `.js` extension:

```js
// dist/src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.js
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate.js'; // emitted by the compiler
import { Invoice } from '../../../domain/aggregates/invoice.aggregate.js'; // after the rewrite
```

What it rewrites: the specifier of `import ... from`, `export ... from`, a bare `import '...'`,
`import('...')` with a string literal (attributes included), `require('...')`,
`import.meta.resolve('...')`, and, in declarations, `import type`, `typeof import("...")` and
`declare module '...'`.

How it stays exact. It does not search the text for the prefix. It runs the scanner the checker
already uses (`packages/cli/src/check/scan`), which walks the file once and tells code from
comments, strings, template literals and regular expressions; a string literal is rewritten
only when the code before it is an import, export or `import(` position. A string that merely
looks like an import (inside another string, a comment, a template, a regular expression, a
method named `import`) is never touched. The target is computed from `rootDir` and `outDir`,
then looked up on disk.

It fails, exits 2 and writes nothing when:

- an alias names no emitted file (`"@/x.js" names no file the build emitted`): a typo the
  compiler already reported, or a module that only has a declaration;
- `import()` or `require()` is given an alias completed at run time
  (`` import(`@/handlers/${name}.js`) ``, `import('@/handlers/' + name)`): no tool can know the
  file, and Node knows no alias. Build the path from `import.meta.url` instead, as the
  generated `scripts/events.ts` does;
- the tsconfig names no output directory that exists.

It is idempotent: a second run finds nothing to rewrite. A rewrite never adds or removes a
line break and the source maps are not modified: every mapping keeps its line and `sources` is
untouched. On the line of a rewritten specifier, what follows it (the closing `;` of a static
import) moves by the difference of length, which the map does not record.

## What was measured

On Node 24.21.0, TypeScript 6.0.3 and the native TypeScript 7.0.2, tsx 4.23.15, vitest 5.0.3
(vite 8.3.4), knip 6.41.0, dependency-cruiser 18.5.0; by hand, outside the workspace, jest
30.5.2 and drizzle-kit 0.31.11. The end-to-end suite replays it on every stack, and CI runs
its run-time part on Node 22 as well (`npm run ci:test:alias`).

- **Compiled and not rewritten, the output does not run**: plain `node` stops at the first
  alias. **Rewritten, it runs**: every compiled module of a generated project and of the
  example links, the application, the worker and a context run alone start, and no alias is
  left in a `.js` or a `.d.ts`.
- **Both compilers** map `@/x.js` to `src/x.ts` (`--explainFiles`), and never to `dist/`.
- **tsx** resolves `@/x.js` to `src/x.ts` with no flag, also when a compiled copy exists and
  also for a module loaded by `--import ./src/platform/tracing.ts`.
- **vitest** with `resolve.tsconfigPaths` runs a spec on the source although a compiled copy
  exists; without it the spec fails on its first import.
- **jest** with the generated `moduleNameMapper` loads the source although a compiled copy
  exists; without it, "Cannot find module".
- **dependency-cruiser** follows the alias to the source and holds no module under `dist/`;
  the boundary rules report an alias import exactly as a relative one.
- **knip** reports an unused file and an unused export behind the alias, and nothing for a
  file that is only imported by its alias.
- **drizzle-kit** generates a migration from a schema that re-exports tables by their alias,
  and fails once `paths` is removed.
- A stale `dist/` cannot be loaded by a dev tool: `paths` names sources only, and a tool that
  ignores `paths` fails instead of falling back.

## The two rules

`imports/alias-only`: under the source root, `test/` and `scripts/`, an `import`, an
`export ... from` or an `import()` of a file of the project uses the alias. A relative
specifier is refused, the same directory included, and so is an alias path with a `.` or `..`
segment. `eslint --fix` rewrites a relative import: it computes the alias from the place of
the file and the config. Not judged: a JavaScript file at the project root (a tool config, a
knex migration, which Node runs as written and which therefore uses relative paths), and the
client under `generated/`. A directory given to `discoverContext` as a URL is not an import.

`imports/alias-declared`, held by `ddd-ts-kit check`:

| It reports | Because |
|---|---|
| an `importAlias` that is not `@/` or `$<name>/`, or that is `$test/`, `$scripts/`, `$generated/` | it could be a package name, it is another mechanism (`#`), or it names another directory; `init` refuses it too |
| a `paths` entry of `tsconfig.json` that is missing, or not exactly what `importAlias` gives (for instance one that names `dist/`) | it is the declaration the compiler and the tools read |
| another `paths` entry under an alias of the project | the build rewrites from `importAlias` alone: the output would load another file than the one that was checked |
| a `baseUrl` | every `paths` target would be resolved from it |
| a `tsconfig.build.json` whose `paths` or `baseUrl` differ from `tsconfig.json` | the build would not compile what was checked |
| a script that compiles (`tsc` without `--noEmit`) and does not run `build-aliases` afterwards | the output would stop under `node` at its first import |
| a script that runs `tsx` with `--tsconfig` on another file | the dev runner would read a declaration nothing compares |
| a `vitest` config at the project root without `tsconfigPaths: true` (one that extends another config of the project is read as carrying it) | the specs would not resolve an alias |
| a `jest` config that lacks one of the derived `moduleNameMapper` entries, or maps it elsewhere | jest reads no tsconfig: it is the one repeated mapping |
| a `.dependency-cruiser.cjs` without `tsConfig: { fileName: 'tsconfig.json' }` | the boundary rules would see nothing; `ddd-ts-kit depcruise-config --check` reports the same file |
| a `paths` entry of `knip.json` under an alias | a second declaration |

The boundary rules themselves (`layer/*`, `context/*`) resolve an alias exactly as a relative
path, in the checker and in the ESLint plugin: one table of forbidden imports is replayed
against both, in both spellings.

An alias that names no file is reported by the compiler (`TS2307`), by dependency-cruiser (the
module resolves to nothing), by knip (unresolved import) and by `build-aliases`.

## Limits

- Only a module the build emits can be named by an alias in shipped code. A JSON file or
  another asset is read at run time, not imported.
- A JavaScript file Node runs as written (a config, a knex migration) cannot use the alias:
  nothing rewrites it.
- `tsc --watch` alone leaves the aliases in `dist/`: a compiled output is produced by
  `npm run build`. Development runs the sources (`npm run dev`), not `dist/`.
- After a rewrite, a source map still names the right line; the column of what follows a
  rewritten specifier on the same line is off by the difference of length.
- Renaming the alias of an existing project is three edits, not a command: `importAlias` in
  the config, the `paths` entry (the fix of `imports/alias-declared` gives it), and a search
  and replace of the prefix in the sources.
- A tool the kit does not know that loads the TypeScript sources itself has to read the
  `paths` of `tsconfig.json` or be given the mapping; `check` knows tsx, vitest, jest,
  dependency-cruiser and knip.

## Recommendation

Keep `@/`. Pass `--import-alias '$<name>/'` to `init` only when `@/` is already taken by
something else in the project. Run `eslint --fix` then `npm run format` to move existing code,
and let `ddd-ts-kit check` say what is left.
