# ddd-ts-kit/layer-domain-purity

Architecture id: `layer/domain-purity`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `domain/` of a context, tests excluded.

## Why

The domain is the part of the system that must survive a change of framework, ORM or transport. Every outward import ties a business rule to a technical decision and makes it untestable without that technology.

## Reported

- a package outside `domainAllowedPackages` (default: `@ddd-ts-kit/kernel`)
- `@ddd-ts-kit/aspects`, `@ddd-ts-kit/audit`, `@ddd-ts-kit/redis` and `@ddd-ts-kit/tracing`, by any entry (`.`, `/decorators`, `/testing`, `/node`, ...), with a message of their own: they apply or record a concern from outside the model
- any Node built-in
- another layer of the same context, the platform, `main.ts`
- the published language of another context (translate it in a consumer or an anti-corruption layer)

Incorrect:

```ts
// src/contexts/billing/domain/aggregates/invoice.aggregate.ts
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { Logged } from '@ddd-ts-kit/aspects/decorators';
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

None. `domainAllowedPackages` in `ddd-ts-kit.config.json` extends the allow-list. The four packages above stay refused even when the list names them: logging, metrics, retry, timeout, circuit breaking, caching and tracing reach the model from the composition root (`.with(...)` on a binding, the `decorate` hook), a bus middleware or an adapter in `infrastructure/`; Redis sits behind a port; the audit trail is fed by the bus middleware, the authorization hook and an event subscription. The only way around is a recorded suppression of the line.

`rules."layer/domain-purity"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line layer/domain-purity -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The target is classified by its path: a barrel in an allowed layer that re-exports a forbidden one is not followed. `dependency-cruiser` (see `pipeline/depcruise-config.mjs`) resolves the real graph and closes that gap.
- A computed specifier (`import(name)`) is not judged.
- `tsconfig` paths other than `importAlias` are not resolved.
- Internals of another context are left to `context-published-language-only`, so that one import gives one report.

## With the CLI checker

`ddd-ts-kit check` reports the same id from a regex reading of the file, fast enough for an editor hook. This rule is the authority: it reads the syntax tree.
