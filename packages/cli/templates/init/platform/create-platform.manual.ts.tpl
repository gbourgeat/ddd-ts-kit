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
{{#if errors.sentry}}
  NoopErrorReporter,
{{/if}}
  ScopedActorContext,
  SystemClock,
  UuidGenerator,
{{#if errors.sentry}}
  errorReportingMiddleware,
{{/if}}
  scopedPublisher,
  dispatchingOnSave,
  unitOfWorkMiddleware,
  type BusMiddleware,
  type DomainEventDispatcher,
{{#if errors.sentry}}
  type ErrorReporter,
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
import { traceApplication, tracedPublisher, tracedSubscriber, type ConsumerTrace, type TracedApplication } from '@ddd-ts-kit/tracing';
{{#if audit.on}}
import { createAudit } from './audit/create-audit.js';
{{/if}}
import { accessPolicies } from './auth/access-policies.js';
import { createAuthorizer } from './auth/create-authorizer.js';
{{#unless audit.on}}
import { logDecisions } from './auth/log-decisions.js';
{{/unless}}
import { UseCaseProtection } from './auth/use-case-protection.js';
import type { Persistence } from './database/persistence.js';
import type { EventProvider } from './events/event-provider.js';
import { ConfiguredJobScheduler } from './jobs/configured-job-scheduler.js';
import { createLogger, type LogSettings } from './observability/create-logger.js';
import { createMetrics } from './observability/create-metrics.js';
import type { Platform } from './platform.js';
{{#if cache.redis}}
import type { RedisServices } from './redis/open-redis.js';
{{/if}}
import { adapterAspects } from './resilience/adapter-aspects.js';
import { defaultResilience } from './resilience/default-resilience.js';
import { ownPolicy } from './resilience/own-policy.js';
import type { ResilienceSettings } from './resilience/resilience-settings.js';

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
  const { clock, logger, metrics, scope } = foundations;
  const domainEvents = traced.domainEvents(new InMemoryDomainEventDispatcher());
  const authorizer = createAuthorizer();
{{#if audit.on}}
  const onDecision = foundations.audit.decisions;
{{/if}}
{{#unless audit.on}}
  const onDecision = logDecisions(logger);
{{/unless}}
  const protection = new UseCaseProtection(authorizer, onDecision);
  const adapter = adapterOf(options.resilience ?? defaultResilience, { traced, domainEvents });
{{#if errors.none}}
  const observed = [loggingMiddleware(logger), metricsMiddleware(metrics), protection.guard, traced.useCase];
{{/if}}
{{#if errors.sentry}}
  // First on both buses, outside the unit of work: a failed commit is reported too.
  const observed = [errorReportingMiddleware(foundations.errors, scope), loggingMiddleware(logger), metricsMiddleware(metrics), protection.guard, traced.useCase];
{{/if}}

  return {
    ...foundations,
    ...eventsOn(persistence, options, { scope, traced }),
    // Around every use case, outermost first: {{#if errors.sentry}}the report of an unexpected failure, {{/if}}its log entry, its measure, the permission, its span; a command then runs in the unit of work.
    commands: chain(new InMemoryCommandBus(), [...observed, ...beforeTheTransaction(foundations, options), unitOfWorkMiddleware(persistence.unitOfWork)]),
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

type Foundations = Pick<Platform, 'scope' | 'clock' | 'ids' | 'logger' | 'metrics'{{#if errors.sentry}} | 'errors'{{/if}} | 'cache' | 'jobs'{{#if cache.rateLimit}} | 'rateLimiter'{{/if}}{{#if audit.on}} | 'audit'{{/if}}>;

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
    jobs: new ConfiguredJobScheduler(new InProcessJobScheduler({ clock, lock, scope, ids, logger, metrics }), options.jobs?.settings ?? {}, traced.job),
{{/if}}
{{#if errors.sentry}}
    // A run that failed, a timeout included, is reported; a skipped or missed occurrence is not.
    jobs: new ConfiguredJobScheduler(new InProcessJobScheduler({ clock, lock, scope, ids, logger, metrics, onRun: reportFailedRuns(errors) }), options.jobs?.settings ?? {}, traced.job),
{{/if}}
{{#if audit.on}}
    audit: createAudit(persistence, { scope, clock, ids }),
{{/if}}
  };
}

type Events = Pick<Platform, 'publisher' | 'subscriber' | 'eventBus'{{#if broker.external}} | 'subscriberFor'{{/if}}>;

/** Use cases publish with the correlation id of the work in progress, so everything one request causes is found again. */
function eventsOn(persistence: Persistence, { events, traceConsumers }: PlatformOptions, { scope, traced }: Observation): Events {
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
  return [
{{#if cache.relaySignal}}
    ...(options.redis === undefined ? [] : [relayWakeUpMiddleware(options.redis.relaySignal)]),
{{/if}}
{{#if audit.on}}
    foundations.audit.commands,
{{/if}}
  ];
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
