**English** · [Français](context-published-language-is-a-contract.fr.md)

# ddd-ts-kit/context-published-language-is-a-contract

Architecture id: `context/published-language-is-a-contract`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `published-language/` of a context, tests excluded.

## Why

What a context publishes must be serializable and stable. A contract that imports the domain exposes the internal model under another name.

## Reported

- any import other than `publishedLanguageAllowedPackages` (default: the kernel, `@ddd-ts-kit/events`, `@ddd-ts-kit/validation` and the schema library of `stack.validation`) and other published languages

Incorrect:

```ts
// src/contexts/billing/published-language/invoice-issued.v1.integration-event.ts
import type { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate';
```

Correct:

```ts
import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import { z } from 'zod';
```

## Details

Static imports, type-only imports, `export ... from`, dynamic `import()`, `require()`, `import x = require()` and `import("...")` types are all read, through relative paths and the configured `importAlias`.

## Options

None. `publishedLanguageAllowedPackages` in `ddd-ts-kit.config.json` replaces the allow-list.

`rules."context/published-language-is-a-contract"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line context/published-language-is-a-contract -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The target is classified by its path: a barrel in an allowed layer that re-exports a forbidden one is not followed. `dependency-cruiser` (see `pipeline/depcruise-config.mjs`) resolves the real graph and closes that gap.
- A computed specifier (`import(name)`) is not judged.
- `tsconfig` paths other than `importAlias` are not resolved.

## With the CLI checker

`ddd-ts-kit check` reports the same id from a regex reading of the file. This rule is the authority for the import; the CLI stays the authority for the config (`config/valid`, `context/no-cycle`).
