# Import aliases: Node subpath imports, declared once

**Summary.** A project built with the kit imports its own files by an alias, never by a
relative path: `#src/contexts/billing/domain/aggregates/invoice.aggregate.js` instead of
`../../../domain/aggregates/invoice.aggregate.js`. The alias is a Node subpath import declared
once, under `imports` in `package.json`. Node resolves it itself, so the compiled output runs
with plain `node`, without a loader, a build-time rewrite or a runtime dependency; the
compiler, the dev runner, the test runner, knip and dependency-cruiser read the same
declaration. Two rules hold it: `imports/alias-only` (every import uses the alias, ESLint
fixes it) and `imports/alias-declared` (the one declaration and everything that has to follow
it agree).

## What is being decided

An alias is declared somewhere and then resolved by many tools: the type checker, the build,
`node` in production, the dev runner, the test runner, ESLint, `ddd-ts-kit check`,
dependency-cruiser, knip. If two of them resolve it differently, nothing fails where the
mistake is made: the type check passes on one file while production loads another, the tests
run a stale build, or a boundary rule stops seeing an import. So the decision is less "which
prefix" than "which mechanism lets every tool read one declaration".

## Comparison

| | Node subpath imports (`#src/`) | tsconfig `paths` (`@/`) and a rewrite at build | tsconfig `paths` and a runtime resolver |
|---|---|---|---|
| Declared in | `package.json`, `imports` | `tsconfig.json`, then repeated for each tool that does not read it | `tsconfig.json`, then a loader or a registration at start |
| Plain `node dist/src/main.js` | yes: Node resolves `#` specifiers natively | only after an extra step rewrote the emitted specifiers (`tsc-alias`, a bundler) | no: `node --import <loader>` or a `require` hook in production |
| TypeScript 6 and the native TypeScript 7 | read `imports`, and map the compiled target back to its source through `rootDir` and `outDir` | read `paths` | read `paths` |
| tsx | reads `imports` | reads `paths` | reads `paths` |
| vitest | reads `imports` | `resolve.alias`, a second declaration | `resolve.alias`, a second declaration |
| jest | reads `imports` | `moduleNameMapper`, a second declaration | `moduleNameMapper`, a second declaration |
| knip | reads `imports` and the tsconfig | reads `paths` | reads `paths` |
| dependency-cruiser | reads `imports` | reads `paths` through its `tsConfig` option | same |
| New dependency in the project | none | a rewrite tool, in the build | a loader, in production |
| What can drift | the condition each source-reading tool sets (one constant, checked) | every repeated mapping, and a build that forgot the rewrite | every repeated mapping, and a start command that forgot the loader |

The kit takes subpath imports. `paths` was what `init` wrote before; nothing rewrote the
emitted specifiers, so an alias import type-checked and then failed under `node`, which is why
the generated code used relative paths everywhere.

## The declaration

`init` writes it, from `importAlias` of `ddd-ts-kit.config.json` (`#src/` by default) and the
`rootDir` and `outDir` of `tsconfig.json`:

```json
"imports": {
  "#src/*.js": { "ddd-ts-kit-source": "./src/*.ts", "default": "./dist/src/*.js" },
  "#test/*.js": "./test/*.ts",
  "#scripts/*.js": { "ddd-ts-kit-source": "./scripts/*.ts", "default": "./dist/scripts/*.js" }
}
```

| Alias | Directory | Notes |
|---|---|---|
| `importAlias`, `#src/` by default | `sourceRoot` | the only one the config renames |
| `#test/` | `test/` | never built: the alias answers the source under every condition |
| `#scripts/` | `scripts/` | built with the sources (`dist/scripts`) |
| `#generated/` | `generated/` | with `stack.orm` `prisma` only: the client Prisma generates |

One entry answers two files. Under the condition `ddd-ts-kit-source` it answers the TypeScript
source; otherwise the compiled file. `node` sets no such condition, so production loads
`dist/`. Whatever runs or reads the sources sets it:

| Tool | What it reads | How it gets the sources |
|---|---|---|
| `node` (production, `npm start`, the Docker image) | `imports`, `default` | nothing to set; the image copies `package.json` next to `dist/` |
| TypeScript 6 and 7 (type check, build, the editor) | `imports`, `default`, mapped back to the source through `rootDir` and `outDir` | nothing to set: `tsconfig.json` does not name the alias |
| tsx (`npm run dev`) | `imports` | `--conditions=ddd-ts-kit-source` in the script |
| drizzle-kit (`npm run db:generate`) | `imports`, through Node | run as `node --conditions=ddd-ts-kit-source node_modules/drizzle-kit/bin.cjs` |
| vitest | `imports` | `ssr: { resolve: { conditions: ['ddd-ts-kit-source'] } }` in its configs |
| jest | `imports` | `testEnvironmentOptions.customExportConditions` in its config |
| dependency-cruiser | `imports` | `conditionNames` of the generated `.dependency-cruiser.cjs` |
| knip | `imports` and the tsconfig | nothing to set |
| ESLint with `@ddd-ts-kit/eslint-plugin`, `ddd-ts-kit check` | `importAlias` and `sourceRoot` of the config | they classify an import by its path and never load a file |
| Biome | nothing | it formats; a fixed import that passes the line width is wrapped by `npm run format` |

The condition has a name of its own on purpose: a generic name such as `source` or
`development` is also declared by packages under `node_modules`, and setting it would change
what those packages load.

## What was measured

On Node 22.23.3 and Node 24.21.0, TypeScript 6.0 and the native TypeScript 7.0, tsx 4.23,
vitest 5.0 (vite 8.3), jest 30.5, knip 6.41, dependency-cruiser 18.5, drizzle-kit 0.31:

- **`#/` is not usable.** Node 22 refuses a subpath import that starts with `#/`
  (`ERR_INVALID_MODULE_SPECIFIER`); Node 24 accepts it. The kit supports Node 22, so the alias
  is `#<name>/`.
- **Plain `node` runs the compiled output** on both versions: every compiled module of a
  generated project and of the example links, and `import.meta.resolve('#src/main.js')`
  answers `dist/src/main.js`.
- **The compilers need nothing in `tsconfig.json`.** Both resolve `#src/x.js` to
  `./dist/src/x.js` and answer `src/x.ts`, whether `dist/` exists or not.
- **A tool that runs sources without the condition loads `dist/`.** tsx, vitest and jest all
  resolve to the compiled file: a stale copy when the project was built earlier, an error
  when it was not. dependency-cruiser follows the alias to `dist/`, which it excludes, and
  then sees no import at all. drizzle-kit fails with `ERR_PACKAGE_IMPORT_NOT_DEFINED`. This is
  the one thing that can drift, which is why `imports/alias-declared` checks each of them.
- **With the condition**, tsx, vitest (`ssr.resolve.conditions`; `resolve.conditions` alone is
  not read by its runner), jest and dependency-cruiser resolve to `src/x.ts`, also when a
  compiled copy exists.
- **knip** reports an unused file and an unused export behind the alias, and nothing for a
  file that is only imported by its alias, with or without `dist/`.

## The two rules

`imports/alias-only`: under the source root, `test/` and `scripts/`, an `import`, an
`export ... from` or an `import()` of a file of the project uses the alias. A relative
specifier is refused, the same directory included, and so is an alias path with a `.` or `..`
segment. `eslint --fix` rewrites a relative import: it computes the alias from the place of
the file and the config. Not judged: a JavaScript file at the project root (a tool config, a
knex migration, which may use the alias and resolves to `dist/`), and the client under
`generated/`. A directory given to `discoverContext` as a URL is not an import.

`imports/alias-declared`, held by `ddd-ts-kit check`:

| It reports | Because |
|---|---|
| an `importAlias` that is not `#<name>/` (`@/`, `#/`), or that is `#test/`, `#scripts/`, `#generated/` | Node could not resolve it from `package.json`, or it names another directory; `init` refuses it too |
| an `imports` entry of `package.json` that is missing, or not exactly what `importAlias`, `rootDir` and `outDir` give, conditions in order | it is the declaration every tool reads |
| another `imports` entry under an alias of the project | two patterns would compete |
| `paths` of `tsconfig.json`, `tsconfig.build.json` or `knip.json` that maps an alias | a second declaration |
| `tsconfig.json` and `tsconfig.build.json` that do not share `rootDir` and `outDir`, or a `moduleResolution` that does not read `imports` | the type check would map an alias to another place than the build writes |
| a script that runs `tsx` or `drizzle-kit` without the condition | it would load `dist/` |
| a `vitest` or `jest` config at the project root without the condition (one that extends another config of the project is read as carrying it) | the specs would run `dist/` |
| a `.dependency-cruiser.cjs` without the condition | the boundary rules would see nothing; `ddd-ts-kit depcruise-config --check` reports the same file |

The boundary rules themselves (`layer/*`, `context/*`) resolve an alias exactly as a relative
path, in the checker and in the ESLint plugin: one table of forbidden imports is replayed
against both, in both spellings.

An alias that names no file is reported by the compiler (`TS2307`), by dependency-cruiser
(`not-to-undeclared-dependency`), by knip (unresolved import) and by Node at run time.

## Limits

- The pattern is `*.js`: only a TypeScript module can be named by the alias. A JSON file or
  another asset is read at run time, not imported.
- `package.json` has to sit next to `dist/` wherever the compiled output runs. The generated
  Dockerfile copies it.
- Renaming the alias of an existing project is three edits, not a command: `importAlias` in
  the config, the `imports` entry (the fix of `imports/alias-declared` gives it), and a search
  and replace of the prefix in the sources.
- A tool the kit does not know that loads the TypeScript sources itself has to be given the
  condition (`node --conditions=ddd-ts-kit-source ...`); `check` only knows `tsx` and
  `drizzle-kit`.

## Recommendation

Keep `#src/`. Pass `--import-alias "#<name>/"` to `init` only when the project already uses
another subpath import by that name. Run `eslint --fix` then `npm run format` to move existing
code, and let `ddd-ts-kit check` say what is left.
