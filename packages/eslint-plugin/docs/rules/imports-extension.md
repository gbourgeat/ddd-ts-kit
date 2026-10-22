**English** · [Français](imports-extension.fr.md)

# ddd-ts-kit/imports-extension

Architecture id: `imports/extension`. Default severity: `error` in `recommended`, `error` in `strict`. Fixable (`eslint --fix`).

Applies to: every TypeScript file under the source root, under `test/` and under `scripts/`.

## Why

An import of a file of the project has one spelling. `importExtension` in `ddd-ts-kit.config.json` says which:

| `importExtension` | An import is written | The compiler resolves it | Who holds the other spelling |
|---|---|---|---|
| `none`, the default of a new project | `@/contexts/billing/domain/aggregates/invoice.aggregate` | as a bundler does (`"moduleResolution": "Bundler"`, with the `node` condition), which accepts both spellings | this rule: the compiler would let `.js` through |
| `js`, also what a config without the key means | `@/contexts/billing/domain/aggregates/invoice.aggregate.js` | as Node does (`"moduleResolution": "NodeNext"`), which requires the extension | the compiler (`TS2835`), and this rule, which fixes it |

Node needs the extension at run time whatever the sources write: `ddd-ts-kit build-aliases`, the second step of `npm run build`, rewrites each alias of the compiled output into a relative path ending in `.js`. The build names one file per specifier and guesses nothing, so a specifier written the other way stops it: this rule reports the mistake in the editor instead. See [Import aliases](../../../../docs/tools/import-aliases.md).

## Reported

- under `none`: an alias specifier that ends with `.js`, `.mjs`, `.cjs`, `.ts`, `.mts` or `.cts`: fixed by removing the extension
- under `js`: an alias specifier that does not end with `.js` (`.mjs` and `.cjs` are accepted, they name what an `.mts` or a `.cts` file emits): fixed by writing `.js` in place of what it ends with

Incorrect under `none`:

```ts
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate.js';
import { startApplication } from '$test/e2e/support/start-application.ts';
```

Correct under `none`:

```ts
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate';
import { startApplication } from '$test/e2e/support/start-application';
```

Incorrect under `js`:

```ts
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate';
```

Correct under `js`:

```ts
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate.js';
```

## Details

Static imports, type-only imports, `export ... from`, `export *`, dynamic `import()`, `import()` types and `require()` are all read. A dynamic import whose specifier is computed is not judged.

Only a specifier that starts with an alias of the project is judged (`importAlias`, `$test/`, `$scripts/`, and `$generated/` with `stack.orm` `prisma`). A package is never a file of the project, whatever its subpath ends with: `zod/v4/core.js` and `@scope/package/file.js` are left alone, and so is a Node built-in. A relative import is reported by [`imports/alias-only`](imports-alias-only.md), whose fix writes the alias with the right ending.

A dot in a file name is not an extension: `invoice.aggregate`, `issue-invoice.command` and `load-config` are all read as written without one.

The fix keeps the quotes of the specifier. Under `none` a fixed import is three characters shorter and may now fit on one line: run the formatter after the fix (`npm run format`). Fixing twice changes nothing.

Not judged: a file outside the three directories (a config file at the project root, a JavaScript migration, which Node runs as written and which therefore keeps its extensions) and the client under `generated/`, which a tool writes.

## Moving a project to the other spelling

A project generated before the key existed is read as `js` and keeps working untouched. To drop the extensions:

1. set `"importExtension": "none"` in `ddd-ts-kit.config.json`;
2. run `ddd-ts-kit check`: `imports/alias-declared` gives the `module`, `moduleResolution` and `customConditions` to write in `tsconfig.json`, and the jest mapping when the project runs jest;
3. run `eslint --fix`, then `npm run format`;
4. regenerate what the kit generates (`ddd-ts-kit generate` or `ddd-ts-kit docs` rewrites the declarations barrels), then `npm run verify`.

## Options

None. `importExtension` of `ddd-ts-kit.config.json` decides.

`rules."imports/extension"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line imports/extension -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A specifier that names a directory (`@/contexts/billing/published-language`, resolved by a bundler to its `index.ts`) is accepted under `none`: `ddd-ts-kit build-aliases` completes it with `/index.js`.
- The rule does not check that `tsconfig.json` resolves as the config says: `imports/alias-declared` of `ddd-ts-kit check` does.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the import specifiers it reads in the text of the files, under the source root, `test/` and `scripts/`, gives the specifier to write in its fix sentence. This rule is the one that rewrites the import.
