---
name: cross-cutting
description: >-
  Keeps cross-cutting concerns out of business code in a ddd-ts-kit project. Logging,
  metrics, retry, timeout, circuit breaker, caching and rate limiting are applied from
  outside (wrappers at the composition root, bus middlewares, decorators on adapters), and
  shared shapes come from the standard extensible interfaces of the kernel (Session,
  ExecutionContext, Logger, Metrics, Cache, Page, AuditStamp). Use when adding logs, metrics,
  resilience or a cache, when code needs a correlation id, the tenant or the session, when
  about to declare a home-made Logger, UserContext, CurrentUser or paginated result type, or
  when aspects/* or standard/* is reported.
allowed-tools:
  - Bash(npx ddd-ts-kit generate *)
  - Bash(npx ddd-ts-kit check *)
---

# Cross-cutting concerns

A handler that logs, measures, retries and caches is four concerns hiding one use case.
Business code states the business; everything else is attached from outside.

## Where each concern goes

| Need | Put it | How |
|---|---|---|
| log, measure every use case | bus middleware, in the platform | `loggingMiddleware`, `metricsMiddleware` |
| trace I/O | composition root | the `decorate` hook with tracing |
| retry, timeout, circuit breaker on an outside call | the binding of the adapter | `.as('external').with(retry({...}), timeout(2000))` |
| the same, when the policy is part of what the adapter is | the adapter class in `infrastructure/` | `@Retry(...)`, `@Timeout(...)` from `@ddd-ts-kit/aspects/decorators` |
| cache a read of another system or context | the binding of the gateway or external adapter | `.with(cached({...}))`; never a repository of aggregates |
| rate limit | in front of the HTTP layer, in the platform | the `RateLimiter` port |
| audit | outside the use cases | skill `ddd-ts-kit:audit-trail` |

`npx ddd-ts-kit generate adapter <ctx> <Port> [--kind external|gateway] [--decorators]` writes an adapter with its
policy attached one way or the other. Prefer the binding form: the adapter imports nothing.
None of these is allowed in `domain/` or `application/`; the checker refuses the import.

Order matters when composing: metrics and logging outermost, then circuit breaker, then
retry, then timeout innermost, so each attempt has its own deadline and the breaker sees the
final outcome.

What an aspect records: class, method, context, duration, error code. Never arguments,
results or error messages: they carry personal data and secrets.

## Standard interfaces

Before declaring a type for one of these, use the kernel's:

| Concept | Kernel | Extend with |
|---|---|---|
| who acts | `Actor` | `ActorExtensions` |
| how they authenticated, impersonation, locale | `Session` | `SessionExtensions` |
| correlation, causation, tenant, origin, deadline | `ExecutionContext` in the `ExecutionScope` | `ExecutionContextExtensions` |
| logs, metrics, cache, lock, rate limit | `Logger`, `Metrics`, `Cache`, `Lock`, `RateLimiter` | well-known fields and labels |
| lists | `Page`, `PageRequest`, `Sort` | generics |
| audit columns, tenant column | `AuditStamp`, `TenantScoped` | |

Extension is declaration merging, in one file of `src/platform/`:

```ts
declare module '@ddd-ts-kit/kernel' {
  interface SessionExtensions {
    readonly practiceId: string;
  }
}
```

A second `UserContext`, `ILogger` or `PaginatedResult` next to the standard one is a defect:
two shapes for one idea, and adapters that no longer fit.

## Who may read the execution scope

Infrastructure and the platform: audit columns, tenant scoping, log fields, correlation on
published events. Use cases receive what they need as data of the command or query
(skill `ddd-ts-kit:access-control`). The domain sees none of it.

## Tests

Fakes for every port: `InMemoryLogger`, `InMemoryMetrics`, `InMemoryCache`, `FixedClock`. The
test application exposes them (`app.logger.entries`). A resilience policy is tested once, on
the adapter, with a fake that fails on demand; use cases are tested without it.
