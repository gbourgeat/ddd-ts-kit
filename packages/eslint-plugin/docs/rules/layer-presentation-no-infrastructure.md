# ddd-ts-kit/layer-presentation-no-infrastructure

Architecture id: `layer/presentation-no-infrastructure`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `presentation/` of a context, tests excluded.

## Why

A route translates a request into a command or a query and a result into a response. When it reaches an adapter directly, the use case is bypassed and so are its rules, its unit of work and its authorization.

## Reported

- an import of `infrastructure/` of the same context

Incorrect:

```ts
// src/contexts/billing/presentation/http/issue-invoice.route.ts
import { DrizzleInvoiceRepository } from '#src/contexts/billing/infrastructure/persistence/drizzle-invoice.repository.js';
```

Correct:

```ts
import { IssueInvoiceCommand } from '#src/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js';
```

## Details

Static imports, type-only imports, `export ... from`, dynamic `import()`, `require()`, `import x = require()` and `import("...")` types are all read, through relative paths and the configured `importAlias`.

## Options

None.

`rules."layer/presentation-no-infrastructure"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line layer/presentation-no-infrastructure -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The target is classified by its path: a barrel in an allowed layer that re-exports a forbidden one is not followed. `dependency-cruiser` (see `pipeline/depcruise-config.mjs`) resolves the real graph and closes that gap.
- A computed specifier (`import(name)`) is not judged.
- `tsconfig` paths other than `importAlias` are not resolved.

## With the CLI checker

`ddd-ts-kit check` reports the same id from a regex reading of the file, fast enough for an editor hook. This rule is the authority: it reads the syntax tree.
