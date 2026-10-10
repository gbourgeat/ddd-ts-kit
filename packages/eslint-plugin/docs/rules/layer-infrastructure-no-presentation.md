# ddd-ts-kit/layer-infrastructure-no-presentation

Architecture id: `layer/infrastructure-no-presentation`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `infrastructure/` of a context, tests excluded.

## Why

Adapters implement ports of the application and the domain. An adapter that knows a DTO of the transport couples persistence to HTTP: the shared type belongs to the application.

## Reported

- an import of `presentation/` of the same context

Incorrect:

```ts
// src/contexts/billing/infrastructure/persistence/drizzle-invoice.repository.ts
import type { IssueInvoiceBody } from '@/contexts/billing/presentation/http/issue-invoice.dto.js';
```

Correct:

```ts
import type { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository.js';
```

## Details

Static imports, type-only imports, `export ... from`, dynamic `import()`, `require()`, `import x = require()` and `import("...")` types are all read, through relative paths and the configured `importAlias`.

## Options

None.

`rules."layer/infrastructure-no-presentation"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line layer/infrastructure-no-presentation -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The target is classified by its path: a barrel in an allowed layer that re-exports a forbidden one is not followed. `dependency-cruiser` (see `pipeline/depcruise-config.mjs`) resolves the real graph and closes that gap.
- A computed specifier (`import(name)`) is not judged.
- `tsconfig` paths other than `importAlias` are not resolved.

## With the CLI checker

`ddd-ts-kit check` reports the same id from a regex reading of the file, fast enough for an editor hook. This rule is the authority: it reads the syntax tree.
