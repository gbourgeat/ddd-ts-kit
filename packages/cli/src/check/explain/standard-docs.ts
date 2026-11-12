import type { RuleDoc } from '../model/rule-doc';

export const STANDARD_DOCS: Readonly<Record<string, RuleDoc>> = {
  'aspects/outside-in': {
    why: 'Logging, metrics, retry, timeout, circuit breaking and caching are applied from outside the code they wrap, so the policy of an application is read in one place and changes without touching a class. The decorator form is the exception: it is kept for an adapter whose policy is part of what the adapter is, in infrastructure/ or in the platform. On a route, a module file, a published language or the shared kernel it hides a policy where nobody looks for one.',
    bad: `// presentation/http/issue-invoice.route.ts
import { Retry } from '@ddd-ts-kit/aspects/decorators';`,
    good: `// billing.module.ts
builder.bind(PaymentGateway).toClass(StripePaymentGateway, [PaymentSettings]).with(retry({ attempts: 3 }), timeout(2000));
// infrastructure/external/stripe-payment.gateway.ts
import { Retry } from '@ddd-ts-kit/aspects/decorators';`,
  },
  'aspects/timeout-covers-delegate': {
    why: 'The platform puts a default policy around every `external` or `gateway` adapter that states none: retries, and a time limit for each attempt (the fallback of OUTBOUND_TIMEOUT_MS in the configuration of the platform, else `timeoutMs` of resilience/default-resilience-settings.ts: 2 seconds as generated). An adapter that only hands its call to another adapter, slow by nature and bound with a longer limit of its own, is then cut by a limit it never chose: every call fails at the default, as a timeout of the outer adapter, and nothing points at the adapter behind it. The same holds for an own policy shorter than the one of the adapter it calls. The rule reads what the text states: `@Adapter` (external when it names no kind) and `@Gateway`, the bindings of the container of the kit (`bind(Port).toClass(Adapter).as(kind).with(...)`), the `@Timeout` of the methods of the adapter behind the port, and durations written as numbers. A duration or a kind read from the configuration, an aspect under `when(...)`, a `@Timeout` on a method of the adapter that is given the port, an environment that sets OUTBOUND_TIMEOUT_MS, a platform wired by hand and the retries around the limit are not judged.',
    bad: `// infrastructure/external/remote-quote-reader.adapter.ts
@Adapter(QuoteReader, { kind: 'external' })
export class RemoteQuoteReader implements QuoteReader {
  constructor(private readonly models: ModelReader) {}
}
// infrastructure/external/remote-model-reader.adapter.ts
@Adapter(ModelReader, { kind: 'external', aspects: [ownPolicy(timeout(120_000))] })
export class RemoteModelReader implements ModelReader {}`,
    good: `// infrastructure/external/remote-quote-reader.adapter.ts
@Adapter(QuoteReader, { kind: 'external', aspects: [ownPolicy(timeout(120_000))] })
export class RemoteQuoteReader implements QuoteReader {
  constructor(private readonly models: ModelReader) {}
}`,
  },
  'tracing/platform-only': {
    why: 'Tracing is non-invasive and wired once. One action is one trace because every span is opened by the same few places: the request boundary, the bus middleware, the instrumentation around adapters and handlers, the outbox relay. A context that imports @ddd-ts-kit/tracing or an @opentelemetry package opens spans of its own, with names and attributes nobody reviews, and can no longer be traced differently by changing the composition root alone. Judged: every source under the source root, tests included, but the platform directory, main.ts and apps/.',
    bad: `// infrastructure/external/stripe-payment.gateway.ts
import { trace } from '@opentelemetry/api';`,
    good: `// src/platform/observability/tracing.ts
import { traceApplication, tracedPublisher } from '@ddd-ts-kit/tracing';
import { initTracing } from '@ddd-ts-kit/tracing/node';`,
  },
  'standard/no-parallel-interface': {
    why: 'The kernel defines the shapes every project shares (Actor, Session, ExecutionContext, Logger, Metrics, Cache, Page and PageRequest, AuditStamp, Clock, IdGenerator, UnitOfWork, JobScheduler, ScheduledJob, ErrorReporter) so that adapters, middlewares and tooling written once fit them all. A home-made ILogger or UserContext next to them forks the shape: every adapter then needs a translation, and the fields of the project never reach the standard logs, spans and audit entries. A project adds its fields by declaration merging of the extension interfaces the kernel leaves open.',
    bad: `// application/ports/logger.port.ts
export abstract class ILogger { abstract info(message: string): void; }
// platform/cron-scheduler.ts
export class CronScheduler {}
// shared-kernel/user-context.ts
export interface UserContext { userId: string; tenantId: string; plan: string }`,
    good: `import type { Logger, ExecutionContext } from '@ddd-ts-kit/kernel';
// platform/kernel-extensions.ts
declare module '@ddd-ts-kit/kernel' {
  interface ExecutionContextExtensions { plan: string }
}
// infrastructure/external/pino.logger.ts
export class PinoLogger implements Logger {}`,
  },
  'governance/recorded-deviation': {
    why: 'The architecture can be changed deliberately, not case by case. A suppression, a lowered severity or a widened list that points to no decision is indistinguishable from a shortcut, and gets copied. The decision record says why, for what scope and until when, so the exception can be reviewed today and removed later.',
    bad: `// eslint-disable-next-line no-console -- needed for the demo
"rules": { "test/spec-required": { "severity": "off", "files": ["src/contexts/billing/infrastructure/**"] } }`,
    good: `// eslint-disable-next-line no-console -- ADR-0004: startup banner read by operations
"rules": { "test/spec-required": { "severity": "off", "files": ["src/contexts/billing/infrastructure/**"] } },
"deviations": [{ "what": "rules.test/spec-required", "adr": "0009", "reason": "Generated adapters are covered by the contract suite." }]
// docs/adr/0004-startup-banner.md, docs/adr/0009-no-spec-for-generated-adapters.md`,
  },
};
