**English** · [Français](context-published-language-only.fr.md)

# ddd-ts-kit/context-published-language-only

Architecture id: `context/published-language-only`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every file of a context, tests included.

## Why

A bounded context owns its model. Another context that imports its aggregate or its table freezes that model: the published language is the only contract designed to be depended on.

## Reported

- an import of another context outside its `published-language/`

Incorrect:

```ts
// src/contexts/billing/application/...
import { Product } from '@/contexts/catalog/domain/aggregates/product.aggregate';
```

Correct:

```ts
import type { ProductListedV1 } from '@/contexts/catalog/published-language/index';
```

## Details

Static imports, type-only imports, `export ... from`, dynamic `import()`, `require()`, `import x = require()` and `import("...")` types are all read, through relative paths and the configured `importAlias`.

## Options

None.

`rules."context/published-language-only"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line context/published-language-only -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The target is classified by its path: a barrel in an allowed layer that re-exports a forbidden one is not followed. `dependency-cruiser` (see `pipeline/depcruise-config.mjs`) resolves the real graph and closes that gap.
- A computed specifier (`import(name)`) is not judged.
- `tsconfig` paths other than `importAlias` are not resolved.
- Files outside the contexts directory (the platform, `main.ts`) are not judged: the composition root knows every context.

## With the CLI checker

`ddd-ts-kit check` reports the same id from a regex reading of the file. This rule is the authority for the import; the CLI stays the authority for the config (`config/valid`, `context/no-cycle`).
