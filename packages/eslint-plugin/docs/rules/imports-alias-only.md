# ddd-ts-kit/imports-alias-only

Architecture id: `imports/alias-only`. Default severity: `error` in `recommended`, `error` in `strict`. Fixable (`eslint --fix`).

Applies to: every TypeScript file under the source root, under `test/` and under `scripts/`.

## Why

An alias names a file from the root of the project. The import reads the same from every file, says which context and which layer it reaches without counting `../`, and does not change when the importing file moves. One spelling also means one thing to review: the layer and context rules of this plugin, `ddd-ts-kit check` and dependency-cruiser resolve an alias exactly as they resolve a relative path, so a boundary is never crossed by choosing the other spelling.

The alias is declared once, under `paths` in `tsconfig.json`, which the compiler and the tools read. Node reads no alias: `ddd-ts-kit build-aliases`, the second step of `npm run build`, rewrites each alias of the compiled output into a relative path, so the output runs with plain `node`: no loader, no runtime dependency. See [Import aliases](../../../../docs/tools/import-aliases.md).

## Reported

- a relative specifier, `./x.js` or `../x.js`, the same directory included: fixed to the alias of the file
- a relative specifier that names a file under no aliased directory (a manifest, a build product): reported, not fixed
- an alias specifier with a `.` or `..` segment, which could name a file outside the directory of the alias: reported, not fixed

Incorrect:

```ts
// src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
import { Invoice } from '../../../domain/aggregates/invoice.aggregate.js';
import { IssueInvoiceCommand } from './issue-invoice.command.js';

// test/e2e/issue-invoice.e2e.spec.ts
import { startApplication } from './support/start-application.js';
```

Correct:

```ts
// src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
import { IssueInvoiceCommand } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js';
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate.js';

// test/e2e/issue-invoice.e2e.spec.ts
import { startApplication } from '$test/e2e/support/start-application.js';
```

## Details

Static imports, type-only imports, `export ... from`, `export *`, dynamic `import()`, `import()` types and `require()` are all read. A dynamic import whose specifier is computed is not judged.

The aliases of a project:

| Alias | Directory | Declared by |
|---|---|---|
| `importAlias` of `ddd-ts-kit.config.json`, `@/` by default | `sourceRoot` | the config |
| `$test/` | `test/` | fixed |
| `$scripts/` | `scripts/` | fixed |
| `$generated/` | `generated/`, with `stack.orm` `prisma` only | fixed |

The fix computes the alias from the place of the file and the config: the relative specifier is resolved from the directory of the file, and the result is written from the directory its alias names, with a `.js` extension. It keeps the quotes of the specifier. A fixed import is often longer than the line: run the formatter after the fix (`npm run format`). Fixing twice changes nothing.

Not judged: a file outside the three directories (a config file at the project root, a JavaScript migration), the client under `generated/`, which a tool writes, and a specifier that is neither relative nor one of the aliases (a package, a Node built-in).

An alias that names no file is not this rule's concern: the compiler reports it (`TS2307`), and the build refuses it (`ddd-ts-kit build-aliases`).

## Options

None. `sourceRoot` and `importAlias` of `ddd-ts-kit.config.json` say what the alias of the sources is.

`rules."imports/alias-only"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line imports/alias-only -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- Only a module the build emits can be named by the alias: a JSON file or another asset is read at run time instead of imported.
- The rule does not check that `tsconfig.json` declares the alias, nor that the build rewrites it: `imports/alias-declared` of `ddd-ts-kit check` does, with everything else that has to follow the one declaration.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the import specifiers it reads in the text of the files, under the source root, `test/` and `scripts/`, and gives the alias to write in its fix sentence. This rule is the one that rewrites the import.
