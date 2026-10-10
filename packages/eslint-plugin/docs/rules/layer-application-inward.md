# ddd-ts-kit/layer-application-inward

Architecture id: `layer/application-inward`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `application/` of a context, tests excluded.

## Why

Use cases orchestrate the domain through ports. An import of an adapter, a driver or a framework makes the use case impossible to run with fakes and moves a technical decision into the application.

## Reported

- a package outside `applicationAllowedPackages`
- `@ddd-ts-kit/aspects`, `@ddd-ts-kit/audit`, `@ddd-ts-kit/redis`, `@ddd-ts-kit/scheduling`, `@ddd-ts-kit/sentry` and `@ddd-ts-kit/tracing`, by any entry (`.`, `/decorators`, `/testing`, `/node`, ...), with a message of their own: they apply or record a concern from outside the use cases
- any Node built-in
- `infrastructure/`, `presentation/` or the module file of the same context
- the platform or `main.ts`

Incorrect:

```ts
// src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
import { eq } from 'drizzle-orm';
import { retry } from '@ddd-ts-kit/aspects';
import { RedisCache } from '@ddd-ts-kit/redis';
import { DrizzleInvoiceRepository } from '#src/contexts/billing/infrastructure/persistence/drizzle-invoice.repository.js';
```

Correct:

```ts
// a port is an abstract class: the type of the dependency and its injection token
import { Cache, Clock } from '@ddd-ts-kit/kernel';
import { InvoiceRepository } from '#src/contexts/billing/domain/repositories/invoice.repository.js';
import { PaymentGateway } from '#src/contexts/billing/application/ports/payment-gateway.port.js';

// declared style
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';

@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, PaymentGateway, Clock])
export class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {}
```

## Details

Static imports, type-only imports, `export ... from`, dynamic `import()`, `require()`, `import x = require()` and `import("...")` types are all read, through relative paths and the configured `importAlias`.

## Options

None. `applicationAllowedPackages` in `ddd-ts-kit.config.json` replaces the allow-list, which defaults to `@ddd-ts-kit/kernel` and `@ddd-ts-kit/auth` (permissions and policies are declared in `application/authorization/`). In a declared-style project (`stack.style: "declared"`) `@ddd-ts-kit/kernel/declarations` is allowed whatever the list says: a handler, a consumer or a policy says what it is with a decorator of that entry, which is pure metadata. In an explicit-style project the entry is allowed like the rest of `@ddd-ts-kit/kernel`, by the list. `@ddd-ts-kit/aspects`, `@ddd-ts-kit/audit`, `@ddd-ts-kit/redis` and `@ddd-ts-kit/tracing` stay refused even when the list names them: an aspect is applied at the composition root (`.with(...)` on a binding, the `decorate` hook), in a bus middleware or on an adapter in `infrastructure/`; a use case depends on the port (`Cache` of the kernel, a port in `application/ports/`) and the platform binds the Redis adapter; the audit trail is fed by the bus middleware, the authorization hook and an event subscription, never by a use case. The only way around is a recorded suppression of the line.

`rules."layer/application-inward"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line layer/application-inward -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The target is classified by its path: a barrel in an allowed layer that re-exports a forbidden one is not followed. `dependency-cruiser` (see `pipeline/depcruise-config.mjs`) resolves the real graph and closes that gap.
- A computed specifier (`import(name)`) is not judged.
- `tsconfig` paths other than `importAlias` are not resolved.

## With the CLI checker

`ddd-ts-kit check` reports the same id from a regex reading of the file, fast enough for an editor hook. This rule is the authority: it reads the syntax tree.
