# ddd-ts-kit/context-declared-relationship

Architecture id: `context/declared-relationship`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every file of a context, tests included.

## Why

Relationships between contexts are strategic decisions written in `ddd-ts-kit.config.json` and drawn in the context map. An import must never be the only place where a dependency exists.

## Reported

- an import of the published language of a context that is not listed in `contexts.<this context>.upstreams`

Incorrect:

```ts
// ddd-ts-kit.config.json: "shipping": { "upstreams": [] }
// src/contexts/shipping/application/integration/handlers/billing-invoice-issued.integration-handler.ts
import type { InvoiceIssuedV1 } from '@/contexts/billing/published-language/index';
```

Correct:

```ts
// ddd-ts-kit.config.json: "shipping": { "upstreams": [{ "context": "billing", "relationship": "published-language" }] }
import type { InvoiceIssuedV1 } from '@/contexts/billing/published-language/index';
```

## Details

Static imports, type-only imports, `export ... from`, dynamic `import()`, `require()`, `import x = require()` and `import("...")` types are all read, through relative paths and the configured `importAlias`.

## Options

None.

`rules."context/declared-relationship"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line context/declared-relationship -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The target is classified by its path: a barrel in an allowed layer that re-exports a forbidden one is not followed. `dependency-cruiser` (see `pipeline/depcruise-config.mjs`) resolves the real graph and closes that gap.
- A computed specifier (`import(name)`) is not judged.
- `tsconfig` paths other than `importAlias` are not resolved.
- Cycles between declared relationships are found by `ddd-ts-kit check` (`context/no-cycle`), which reads the whole config.

## With the CLI checker

`ddd-ts-kit check` reports the same id from a regex reading of the file. This rule is the authority for the import; the CLI stays the authority for the config (`config/valid`, `context/no-cycle`).
