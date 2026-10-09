# ddd-ts-kit/layer-application-inward

Architecture id: `layer/application-inward`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `application/` of a context, tests excluded.

## Why

Use cases orchestrate the domain through ports. An import of an adapter, a driver or a framework makes the use case impossible to run with fakes and moves a technical decision into the application.

## Reported

- a package outside `applicationAllowedPackages`
- any Node built-in
- `infrastructure/`, `presentation/` or the module file of the same context
- the platform or `main.ts`

Incorrect:

```ts
// src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
import { eq } from 'drizzle-orm';
import { DrizzleInvoiceRepository } from '../../../infrastructure/persistence/drizzle-invoice.repository.js';
```

Correct:

```ts
import type { Clock } from '@ddd-ts-kit/kernel';
import type { InvoiceRepository } from '../../../domain/repositories/invoice.repository.js';
import type { PaymentGateway } from '../../ports/payment-gateway.port.js';
```

## Details

Static imports, type-only imports, `export ... from`, dynamic `import()`, `require()`, `import x = require()` and `import("...")` types are all read, through relative paths and the configured `importAlias`.

## Options

None. `applicationAllowedPackages` in `ddd-ts-kit.config.json` extends the allow-list.

`rules."layer/application-inward"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line layer/application-inward -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The target is classified by its path: a barrel in an allowed layer that re-exports a forbidden one is not followed. `dependency-cruiser` (see `pipeline/depcruise-config.mjs`) resolves the real graph and closes that gap.
- A computed specifier (`import(name)`) is not judged.
- `tsconfig` paths other than `importAlias` are not resolved.

## With the CLI checker

`ddd-ts-kit check` reports the same id from a regex reading of the file, fast enough for an editor hook. This rule is the authority: it reads the syntax tree.
