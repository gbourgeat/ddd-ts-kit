import { loggingMiddleware, metricsMiddleware } from '@ddd-ts-kit/aspects';
import { PolicyAccess } from '@ddd-ts-kit/auth';
{{#if events.outbox}}
import { OutboxPublisher } from '@ddd-ts-kit/events';
{{/if}}
import {
  AsyncLocalStorageExecutionScope,
  InMemoryCache,
  InMemoryCommandBus,
  InMemoryDomainEventDispatcher,
  InMemoryLock,
  InMemoryQueryBus,
{{#if cache.rateLimit}}
  InMemoryRateLimiter,
{{/if}}
  NoopErrorReporter,
{{#if httpCache.varnish}}
  PublishedCacheInvalidation,
{{/if}}
  ScopedActorContext,
  SystemClock,
  UuidGenerator,
{{#if errors.sentry}}
  errorReportingMiddleware,
{{/if}}
  scopedPublisher,
  dispatchingOnSave,
  reportAfterCommitFailures,
  unitOfWorkMiddleware,
  type BusMiddleware,
{{#if httpCache.varnish}}
  type CacheInvalidation,
{{/if}}
  type DomainEventDispatcher,
{{#if errors.sentry}}
  type ErrorReporter,
{{/if}}
{{#if httpCache.varnish}}
  type IntegrationEventPublisher,
{{/if}}
  type JobSettings,
} from '@ddd-ts-kit/kernel';
{{#if cache.relaySignal}}
import { relayWakeUpMiddleware } from '@ddd-ts-kit/redis';
{{/if}}
{{#if errors.none}}
import { InProcessJobScheduler } from '@ddd-ts-kit/scheduling';
{{/if}}
{{#if errors.sentry}}
import { InProcessJobScheduler, reportFailedRuns } from '@ddd-ts-kit/scheduling';
{{/if}}
import {
  traceApplication,
  tracedPublisher,
  tracedSubscriber,
  type ConsumerTrace,
  type TracedApplication,
} from '@ddd-ts-kit/tracing';
{{#if audit.on}}
import { createAudit } from '{{alias.platform}}/audit/create-audit{{alias.ext}}';
{{/if}}
import { accessPolicies } from '{{alias.platform}}/auth/access-policies{{alias.ext}}';
import { createAuthorizer } from '{{alias.platform}}/auth/create-authorizer{{alias.ext}}';
{{#unless audit.on}}
import { logDecisions } from '{{alias.platform}}/auth/log-decisions{{alias.ext}}';
{{/unless}}
import { UseCaseProtection } from '{{alias.platform}}/auth/use-case-protection{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
import type { EventProvider } from '{{alias.platform}}/events/event-provider{{alias.ext}}';
import { ConfiguredJobScheduler } from '{{alias.platform}}/jobs/configured-job-scheduler{{alias.ext}}';
import { createLogger, type LogSettings } from '{{alias.platform}}/observability/create-logger{{alias.ext}}';
import { createMetrics } from '{{alias.platform}}/observability/create-metrics{{alias.ext}}';
import type { Platform } from '{{alias.platform}}/platform{{alias.ext}}';
{{#if cache.redis}}
import type { RedisServices } from '{{alias.platform}}/redis/open-redis{{alias.ext}}';
{{/if}}
import { adapterAspects } from '{{alias.platform}}/resilience/adapter-aspects{{alias.ext}}';
import { defaultResilience } from '{{alias.platform}}/resilience/default-resilience{{alias.ext}}';
import { ownPolicy } from '{{alias.platform}}/resilience/own-policy{{alias.ext}}';
import type { ResilienceSettings } from '{{alias.platform}}/resilience/resilience-settings{{alias.ext}}';

interface JobsOptions {
  readonly start?: boolean;
  /** What configuration changes of a job, by job name: what `job-settings.ts` answers. */
  readonly settings?: Readonly<Record<string, JobSettings>>;
}

/** What the platform is built on, beyond the storage: chosen in `main.ts`, defaulted for the tools and the tests. */
export interface PlatformOptions {
  /** The provider integration events are delivered to: the broker in `main.ts`, the process itself for the tools and most tests. */
  readonly events: EventProvider;
  /** Where log entries go; left out, the application writes nothing. */
  readonly log?: LogSettings;
{{#if errors.sentry}}
  /** Where unexpected failures are reported: the reporter of `errors.ts` in `main.ts`; left out (the tools, the tests), nowhere. */
  readonly errors?: ErrorReporter;
{{/if}}
  /** The policy around every adapter that leaves the process; left out, the defaults of `resilience/default-resilience.ts`. */
  readonly resilience?: ResilienceSettings;
  /** Whether this process runs the scheduled jobs, and their settings; left out (the tools, the tests), no job runs by time. */
  readonly jobs?: JobsOptions;
  /** Whether a consumed event continues the trace of its publication (the default) or starts one linked to it. */
  readonly traceConsumers?: ConsumerTrace;
{{#if cache.redis}}
  /** The Redis protocol server; left out, the cache, the lock and the limiter stay in the memory of the process. */
  readonly redis?: RedisServices;
{{/if}}
}

/** Replacing a provider (another broker, another clock) happens here and nowhere else. */
export function createPlatform(persistence: Persistence, options: PlatformOptions): Platform {
  const traced = traceApplication({ consumers: options.traceConsumers ?? 'continue' });
  const foundations = lay(persistence, options, traced);
  const { clock, logger, scope } = foundations;
  // A handler of the after-commit phase that fails is logged{{#if errors.sentry}} and reported{{/if}}: the command it follows is committed, and answers.
{{#if errors.none}}
  const afterCommitFailed = reportAfterCommitFailures({ reporter: new NoopErrorReporter(), logger, scope });
{{/if}}
{{#if errors.sentry}}
  const afterCommitFailed = reportAfterCommitFailures({ reporter: foundations.errors, logger, scope });
{{/if}}
  const domainEvents = traced.domainEvents(new InMemoryDomainEventDispatcher(afterCommitFailed));
  const authorizer = createAuthorizer();
{{#if audit.on}}
  const onDecision = foundations.audit.decisions;
{{/if}}
{{#unless audit.on}}
  const onDecision = logDecisions(logger);
{{/unless}}
  const protection = new UseCaseProtection(authorizer, onDecision);
  const adapter = adapterOf(options.resilience ?? defaultResilience, { traced, domainEvents });
  const observed = observing(foundations, protection.guard, traced.useCase);
{{#if httpCache.varnish}}
  const events = eventsOn(persistence, options, { scope, traced });
{{/if}}

  return {
    ...foundations,
{{#if httpCache.varnish}}
    ...events,
    cacheInvalidation: cacheInvalidationOf(events.publisher, foundations),
{{/if}}
{{#unless httpCache.varnish}}
    ...eventsOn(persistence, options, { scope, traced }),
{{/unless}}
    // Around every use case, outermost first: {{#if errors.sentry}}the report of an unexpected failure, {{/if}}its log entry, its measure, the permission, its span; a command then runs in the unit of work.
    commands: chain(new InMemoryCommandBus(), [
      ...observed,
      ...beforeTheTransaction(foundations, options),
      unitOfWorkMiddleware(persistence.unitOfWork),
    ]),
    queries: chain(new InMemoryQueryBus(), [...observed{{#if audit.on}}, foundations.audit.queries{{/if}}]),
    domainEvents,
    persistence,
    access: new PolicyAccess({ authorizer, clock, policies: accessPolicies, onDecision }),
    actors: new ScopedActorContext(scope, foundations.ids),
    adapter,
    selfGoverned: (instance, info) => adapter(ownPolicy()(instance, info), info),
    protection,
  };
}

/** What surrounds every use case on both buses, outermost first, before what each bus adds. */
function observing(foundations: Foundations, guard: BusMiddleware, span: BusMiddleware): readonly BusMiddleware[] {
{{#if errors.none}}
  return [loggingMiddleware(foundations.logger), metricsMiddleware(foundations.metrics), guard, span];
{{/if}}
{{#if errors.sentry}}
  // First on both buses, outside the unit of work: a failed commit is reported too.
  return [
    errorReportingMiddleware(foundations.errors, foundations.scope),
    loggingMiddleware(foundations.logger),
    metricsMiddleware(foundations.metrics),
    guard,
    span,
  ];
{{/if}}
}

type Founded = 'scope' | 'clock' | 'ids' | 'logger' | 'metrics'{{#if errors.sentry}} | 'errors'{{/if}} | 'cache' | 'jobs'{{#if cache.rateLimit}} | 'rateLimiter'{{/if}}{{#if audit.on}} | 'audit'{{/if}};
type Foundations = Pick<Platform, Founded>;

/** What exists before anything else: one execution scope, one clock and one generator for the whole application. */
function lay(persistence: Persistence, options: PlatformOptions, traced: TracedApplication): Foundations {
  const scope = new AsyncLocalStorageExecutionScope();

  // Spans and log fields carry the correlation id of the work in progress.
  traced.executionScope(scope);

  const clock = new SystemClock();
  const ids = new UuidGenerator();
  const logger = createLogger(scope, options.log);
  const metrics = createMetrics();
{{#if errors.sentry}}
  // Reports carry the id of the trace they happened in.
  const errors = traced.errorReporter(options.errors ?? new NoopErrorReporter());
{{/if}}
{{#if cache.redis}}
  const lock = options.redis?.lock ?? new InMemoryLock(clock);
{{/if}}
{{#unless cache.redis}}
  // TODO(platform): this lock excludes inside one process only. Before running several instances, give the scheduler a lock between processes (`RedisLock` of @ddd-ts-kit/redis), or each instance runs every job.
  const lock = new InMemoryLock(clock);
{{/unless}}

  return {
    scope,
    clock,
    ids,
    logger,
    metrics,
{{#if errors.sentry}}
    errors,
{{/if}}
{{#if cache.redis}}
    cache: options.redis?.cache(metrics) ?? new InMemoryCache(clock),
{{/if}}
{{#unless cache.redis}}
    cache: new InMemoryCache(clock),
{{/unless}}
{{#if cache.rateLimit}}
    rateLimiter: options.redis?.rateLimiter ?? new InMemoryRateLimiter(clock),
{{/if}}
{{#if errors.none}}
    jobs: new ConfiguredJobScheduler(
      new InProcessJobScheduler({ clock, lock, scope, ids, logger, metrics }),
      options.jobs?.settings ?? {},
      traced.job,
    ),
{{/if}}
{{#if errors.sentry}}
    // A run that failed, a timeout included, is reported; a skipped or missed occurrence is not.
    jobs: new ConfiguredJobScheduler(
      new InProcessJobScheduler({ clock, lock, scope, ids, logger, metrics, onRun: reportFailedRuns(errors) }),
      options.jobs?.settings ?? {},
      traced.job,
    ),
{{/if}}
{{#if audit.on}}
    audit: createAudit(persistence, { scope, clock, ids }),
{{/if}}
  };
}

type Events = Pick<Platform, 'publisher' | 'subscriber' | 'eventBus'{{#if broker.external}} | 'subscriberFor'{{/if}}>;

/** Use cases publish with the correlation id of the work in progress, so everything one request causes is found again. */
function eventsOn(
  persistence: Persistence,
  { events, traceConsumers }: PlatformOptions,
  { scope, traced }: Observation,
): Events {
  const trace = traceConsumers ?? 'continue';

  return {
{{#if events.outbox}}
    // `outbox append <type>` inside the request; the relay publishes later, in the same trace.
    publisher: traced.publisher(scopedPublisher(new OutboxPublisher(persistence.outbox), scope)),
{{/if}}
{{#unless events.outbox}}
    publisher: traced.publisher(scopedPublisher(events.bus, scope)),
{{/unless}}
    subscriber: tracedSubscriber(events.bus, { trace }),
{{#if broker.external}}
    subscriberFor: (context) => tracedSubscriber(events.forConsumer(context), { trace }),
{{/if}}
    eventBus: tracedPublisher(events.bus),
  };
}

{{#if httpCache.varnish}}
/**
 * The purges a change asks for, written to the outbox with it: a rollback takes them away, the relay sends them to
 * Varnish once committed{{#if httpCache.perTenant}}. Filed under the tenant of the work, as the answers are tagged{{/if}}.
 */
function cacheInvalidationOf(
  publisher: IntegrationEventPublisher,
  { ids, clock, scope }: Foundations,
): CacheInvalidation {
{{#if httpCache.perTenant}}
  return new PublishedCacheInvalidation({ publisher, ids, clock, scope, perTenant: true });
{{/if}}
{{#unless httpCache.perTenant}}
  return new PublishedCacheInvalidation({ publisher, ids, clock, scope });
{{/unless}}
}

{{/if}}
interface Observation {
  readonly scope: Platform['scope'];
  readonly traced: TracedApplication;
}

/**
 * What runs on the command bus between the permission and the unit of work{{#if audit.on}}: the audit entry opens
 * the transaction itself, so that the entry of a success commits with the state change and the
 * entry of a failure survives the rollback{{/if}}.
 */
function beforeTheTransaction(foundations: Foundations, options: PlatformOptions): readonly BusMiddleware[] {
{{#if cache.relaySignal}}
{{#if audit.on}}
  return [
    ...(options.redis === undefined ? [] : [relayWakeUpMiddleware(options.redis.relaySignal)]),
    foundations.audit.commands,
  ];
{{/if}}
{{#unless audit.on}}
  return [...(options.redis === undefined ? [] : [relayWakeUpMiddleware(options.redis.relaySignal)])];
{{/unless}}
{{/if}}
{{#unless cache.relaySignal}}
{{#if audit.on}}
  return [foundations.audit.commands];
{{/if}}
{{#unless audit.on}}
  return [];
{{/unless}}
{{/unless}}
}

interface Chainable<Bus> {
  use(middleware: BusMiddleware): Bus;
}

/** The middlewares of a bus, outermost first. */
function chain<Bus extends Chainable<Bus>>(bus: Bus, middlewares: readonly BusMiddleware[]): Bus {
  return middlewares.reduce((current, middleware) => current.use(middleware), bus);
}

interface Outside {
  readonly traced: TracedApplication;
  readonly domainEvents: DomainEventDispatcher;
}

/**
 * Around every adapter, outermost first: its span, for a repository the dispatch of the domain
 * events of what it saves (handlers only save), then the retries and the time limit of what
 * leaves the process.
 */
function adapterOf(settings: ResilienceSettings, { traced, domainEvents }: Outside): Platform['adapter'] {
  const resilient = adapterAspects(settings);

  return (instance, info) => {
    const governed = resilient(instance, info);
    const saving = info.kind === 'repository' ? dispatchingOnSave(governed, () => domainEvents) : governed;

    return traced.binding(saving, { ...info, context: info.context ?? 'platform' });
  };
}
