# ddd-ts-kit/layer-domain-purity

Architecture id: `layer/domain-purity`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `domain/` of a context, tests excluded.

## Why

The domain is the part of the system that must survive a change of framework, ORM or transport. Every outward import ties a business rule to a technical decision and makes it untestable without that technology.

## Reported

- a package outside `domainAllowedPackages` (default: `@ddd-ts-kit/kernel`)
- any Node built-in
- another layer of the same context, the platform, `main.ts`
- the published language of another context (translate it in a consumer or an anti-corruption layer)

Incorrect:

```ts
// src/contexts/billing/domain/aggregates/invoice.aggregate.ts
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { InvoiceRow } from '../../infrastructure/persistence/billing.schema.js';
```

Correct:

```ts
// src/contexts/billing/domain/aggregates/invoice.aggregate.ts
import { AggregateRoot } from '@ddd-ts-kit/kernel';
import type { Amount } from '../value-objects/amount.vo.js';
import { Money } from '@/shared-kernel/money.vo.js';
```

## Details

Static imports, type-only imports, `export ... from`, dynamic `import()`, `require()`, `import x = require()` and `import("...")` types are all read, through relative paths and the configured `importAlias`.

## Options

None. `domainAllowedPackages` in `ddd-ts-kit.config.json` extends the allow-list.

`rules."layer/domain-purity"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line layer/domain-purity -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The target is classified by its path: a barrel in an allowed layer that re-exports a forbidden one is not followed. `dependency-cruiser` (see `pipeline/depcruise-config.mjs`) resolves the real graph and closes that gap.
- A computed specifier (`import(name)`) is not judged.
- `tsconfig` paths other than `importAlias` are not resolved.
- Internals of another context are left to `context-published-language-only`, so that one import gives one report.

## With the CLI checker

`ddd-ts-kit check` reports the same id from a regex reading of the file, fast enough for an editor hook. This rule is the authority: it reads the syntax tree.
