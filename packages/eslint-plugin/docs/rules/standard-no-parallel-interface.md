# ddd-ts-kit/standard-no-parallel-interface

Architecture id: `standard/no-parallel-interface`. Default severity: `warn` in `recommended`, `error` in `strict`.

Applies to: every production file under the source root; tests excluded.

## Why

The kernel defines the shapes every project shares (`Actor`, `Session`, `ExecutionContext`, `Logger`, `Metrics`, `Cache`, `Page` and `PageRequest`, `AuditStamp`, `Clock`, `IdGenerator`, `UnitOfWork`, `JobScheduler`, `ScheduledJob`, `ErrorReporter`), so that an adapter, a middleware or a dashboard written once fits them all. A home-made `ILogger` or `UserContext` next to them forks the shape: every adapter needs a translation, and the fields of the project never reach the standard log lines, spans and audit entries.

## Reported

A class, an interface or a type alias declared under one of these names:

| Declared name | Use instead |
|---|---|
| `ILogger`, `AppLogger`, `LoggerService`, `LoggerInterface` | `Logger` |
| `IMetrics`, `MetricsService` | `Metrics` |
| `ICache`, `CacheService` | `Cache` |
| `UserContext`, `CurrentUser`, `AuthContext`, `RequestContext` (outside `presentation/` and the platform), `IExecutionContext`, `IActor` | `ExecutionContext` or `Actor` |
| `UserSession`, `AuthSession`, `SessionData`, `ISession` | `Session` |
| `PaginatedResult`, `PageResult`, `PaginatedResponse`, `Paginated`, `IPage` | `Page` |
| `PaginationParams`, `PageParams`, `IPageRequest` | `PageRequest` |
| `AuditLog`, `AuditLogEntry`, `AuditRecord`, `IAuditEntry` | `AuditEntry` of `@ddd-ts-kit/audit` (`AuditStamp`, also `IAuditStamp`, for audit columns) |
| `IClock`, `IIdGenerator`, `IUnitOfWork` | `Clock`, `IdGenerator`, `UnitOfWork` |
| `IJobScheduler`, `JobSchedulerService`, `CronScheduler`, `TaskScheduler` | `JobScheduler` |
| `IScheduledJob`, `CronJob`, `ScheduledTask`, `BackgroundJob` | `ScheduledJob` |
| `IErrorReporter`, `ErrorReporterService`, `ErrorTracker`, `ExceptionReporter`, `CrashReporter` | `ErrorReporter` |
| `ICacheInvalidation`, `CacheInvalidator`, `CacheInvalidationService` | `CacheInvalidation` |
| `ICachePurger`, `CachePurgeService`, `CdnPurger` | `CachePurger` |

Incorrect:

```ts
// src/contexts/billing/application/ports/logger.port.ts
export interface ILogger {
  info(message: string): void;
}

// src/shared-kernel/user-context.ts
export interface UserContext {
  userId: string;
  tenantId: string;
  plan: string;
}
```

Correct:

```ts
import type { ExecutionContext, Logger } from '@ddd-ts-kit/kernel';

// src/platform/kernel-extensions.ts
declare module '@ddd-ts-kit/kernel' {
  interface ExecutionContextExtensions {
    plan: string;
  }
}

// src/contexts/billing/infrastructure/external/pino.logger.ts
export class PinoLogger implements Logger {}
```

## Details

The match is the whole declared name, case-sensitive, against an explicit table: the names above, and `I` followed by a standard name. Nothing is inferred from a word inside a name, so `StdoutLogger`, `RedisCache`, `UserSessionPolicy`, `PageLayout` and `FakeLogger` are not reported, and neither are the kernel names themselves, their imports or their uses.

A class that `implements` or `extends` the interface it would replace (`class CacheService implements Cache`) is an implementation, not a second interface, and is not reported; name it after its technology all the same. An interface that `extends` the kernel one, and a type alias of it, are reported: the kernel interfaces are extended by declaration merging of `SessionExtensions`, `ExecutionContextExtensions`, `ActorExtensions`, `LogFields` and `MetricLabels`, not by a subtype under another name.

`RequestContext` is the context of one transport request: `presentation/` of a context and the platform may declare one.

## Options

None. The table is changed by `standardInterfaces` in `ddd-ts-kit.config.json`, merged over the defaults: a string adds a name or replaces what to use instead, `false` drops a default.

```json
{
  "standardInterfaces": {
    "TenantInfo": "TenantScoped",
    "CurrentUser": false
  }
}
```

`rules."standard/no-parallel-interface"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line standard/no-parallel-interface -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A domain concept that carries one of these names for a good reason (an `AuditLog` aggregate in an audit context, a `CurrentUser` read model of an identity context whose glossary defines the term) is reported: the glossary is not read. Drop the entry in `standardInterfaces`, or record the suppression of the line.
- A parallel shape under a name the table does not hold (`LogService`, `Pagination`, `Principal`) is not seen; add it to `standardInterfaces`.
- A copy made without a declaration of its own (an inline object type, a re-export under another name, `export { Logger as ILogger }`) is not seen.
- A class expression (`const ILogger = class {}`) and an enum are not judged.
- The class exemption reads the names in `implements` and `extends`, not what they resolve to: a local interface called `Logger` exempts the class as well.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the declarations it reads in the text of the files, with the same table (a test pins the two) and the same exemptions. This rule is the authority.
