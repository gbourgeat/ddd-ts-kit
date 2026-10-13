---
name: cross-cutting
description: >-
  Keeps technical concerns out of business code in a ddd-ts-kit project. Logging, metrics,
  tracing, error reporting, the audit trail, retry, timeout, circuit breaker, caching and
  rate limiting are applied from outside the use cases (the composition root, bus
  middlewares, adapters), on the standard interfaces of the kernel. Use when adding logs,
  metrics, traces, an error tracker, an audit log, resilience or a cache, when choosing a
  logger, when code needs a correlation id, the tenant or the session, when about to
  declare a home-made Logger, UserContext or paginated result, or when aspects/*,
  standard/* or a tracing or audit import in domain or application is reported.
allowed-tools:
  - Read
  - Edit
  - Bash(npx ddd-ts-kit generate *)
  - Bash(npx ddd-ts-kit check *)
  - Bash(npx ddd-ts-kit explain *)
---

# Cross-cutting concerns

A handler that logs, measures, retries, reports and audits is five concerns hiding one use
case. Business code states the business; everything else is attached from outside, in
`src/platform/` and in adapters. `@ddd-ts-kit/aspects`, `audit`, `redis` and `tracing` are
refused in `domain/` and `application/` even when an allow-list names them, and tracing is
imported by the platform, `main.ts` and `apps/` only (`tracing/platform-only`).

## Where each concern goes

| Need | Put it | With |
|---|---|---|
| log and measure every use case | bus middlewares, `src/platform/buses/` | `loggingMiddleware`, `metricsMiddleware` |
| the logger itself | `src/platform/observability/create-logger.ts` | the kernel `Logger` port; `stack.logger` chooses the adapter: `stdout` (default), `pino` or `winston` |
| trace the application | `src/platform/tracing.ts`, first import of `main.ts`, and the instrumentation given to the kernel module | [tracing.md](tracing.md) |
| report unexpected failures | the boundaries, never a use case | the kernel `ErrorReporter` port; `stack.errors: sentry` wires `@ddd-ts-kit/sentry` (Sentry or GlitchTip) in `src/platform/errors.ts` |
| who did what | around the use cases, in `src/platform/audit/` | [audit-trail.md](audit-trail.md) |
| retry, timeout, circuit breaker on an outside call | the adapter's declaration or binding; defaults in `src/platform/resilience/` | `@Adapter(Port, { kind, aspects })`, or `.with(retry(...), timeout(...))` in an explicit module |
| the same, when the policy is part of what the adapter is | the adapter class, in `infrastructure/` only | `@Retry`, `@Timeout` of `@ddd-ts-kit/aspects/decorators` (`aspects/outside-in`) |
| cache a read of another system or context | the gateway or external adapter | `cached({...})`; never a repository of aggregates |
| rate limit | in front of the HTTP layer | the kernel `RateLimiter` port |

`npx ddd-ts-kit generate adapter <ctx> <Port> [--kind external|gateway] [--decorators]`
writes an adapter with its policy attached (`retry` then `timeout`). Order when composing,
outermost first: logging and metrics, then retry, then circuit breaker, then timeout. Each
attempt then counts for the breaker and has its own time limit, and an open circuit ends
the retries at once.

## What may be recorded

By a log, a span, a metric, an error report: class, method, context, duration, error code,
correlation and trace identifiers, the actor's identifier. Never arguments, results, error
messages or full URLs: they carry personal data and secrets.

## Error reporting

An unexpected failure is reported once, by the first boundary that sees it: a 5xx response,
a command failing on something that is not a business refusal, an integration event buried
after its retries, a failed job, a crash of the process. A `DomainError` is an answer, not an
incident: it is mapped to a status and never reported. Handlers throw; they never call the
reporter, and never catch to log.

## Standard interfaces

Before declaring a type for one of these, use the kernel's (`standard/no-parallel-interface`):

| Concept | Kernel | Extend through |
|---|---|---|
| who acts, how they authenticated | `Actor`, `Session` | `ActorExtensions`, `SessionExtensions` |
| correlation, causation, tenant, origin | `ExecutionContext` in the `ExecutionScope` | `ExecutionContextExtensions` |
| logs, metrics, cache, lock, rate limit, jobs, errors | `Logger`, `Metrics`, `Cache`, `Lock`, `RateLimiter`, `JobScheduler`, `ErrorReporter` | an adapter of the port |
| lists | `Page`, `PageRequest` | generics |
| audit columns, tenant column | `AuditStamp`, `TenantScoped` | |

Extension is declaration merging in one file of `src/platform/`
(`declare module '@ddd-ts-kit/kernel' { interface SessionExtensions { ... } }`). A second
`UserContext`, `ILogger` or `PaginatedResult` is a defect.

## Who may read the execution scope

Infrastructure and the platform: audit columns, tenant scoping, log fields, the correlation
id and the tenant on published events. A key of a shared store (cache, rate limit, lock) in a
multi-tenant project is confined with `tenantCacheKey` or `tenantKey`; a job states
`tenancy: 'global'` or `'per-tenant'`; platform staff read across tenants through
`acrossTenants`, audited, never through a role. Use cases receive what they need as data of the command or query
(skill `ddd-ts-kit:access-control`). The domain sees none of it.

## Tests

The test application exposes in-memory implementations: `logger.entries`, `metrics.samples`,
`errors.reports`, `cache`, `clock`. A resilience policy is tested once, on the adapter, with
a fake that fails on demand; use cases are tested without it.
