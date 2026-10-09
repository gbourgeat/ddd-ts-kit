import { loggingMiddleware, metricsMiddleware, type AspectInfo } from '@ddd-ts-kit/aspects';
import { Access } from '@ddd-ts-kit/auth';
{{#if events.outbox}}
import { OutboxPublisher } from '@ddd-ts-kit/events';
{{/if}}
import {
  AsyncLocalStorageExecutionScope,
  InMemoryCache,
  InMemoryCommandBus,
  InMemoryDomainEventDispatcher,
  InMemoryQueryBus,
{{#if cache.rateLimit}}
  InMemoryRateLimiter,
{{/if}}
  ScopedActorContext,
  SystemClock,
  UuidGenerator,
  scopedPublisher,
  unitOfWorkMiddleware,
  type ActorContext,
  type BusMiddleware,
  type Cache,
  type Clock,
  type DomainEventDispatcher,
  type ExecutionScope,
  type IdGenerator,
  type IntegrationEventPublisher,
  type IntegrationEventSubscriber,
  type Logger,
  type Metrics,
{{#if cache.rateLimit}}
  type RateLimiter,
{{/if}}
} from '@ddd-ts-kit/kernel';
{{#if cache.relaySignal}}
import { relayWakeUpMiddleware } from '@ddd-ts-kit/redis';
{{/if}}
import { tracedPublisher, tracedSubscriber } from '@ddd-ts-kit/tracing';
{{#if audit.on}}
import { createAudit, type Audit } from './audit/audit.js';
{{/if}}
import { accessPolicies } from './auth/access-policies.js';
import { UseCaseProtection } from './auth/authorization.js';
import { createAuthorizer } from './auth/authorizer.js';
{{#unless audit.on}}
import { logDecisions } from './auth/decision-log.js';
{{/unless}}
{{#if cache.redis}}
import type { RedisServices } from './cache.js';
{{/if}}
import type { Persistence } from './database/persistence.js';
import type { EventProvider } from './events.js';
import { createLogger, createMetrics, type LogSettings } from './observability.js';
import { DEFAULT_RESILIENCE, adapterAspects, ownPolicy, type ResilienceSettings } from './resilience.js';

/** What the platform is built on, beyond the storage: chosen in `main.ts`, defaulted for the tools and the tests. */
export interface PlatformOptions {
  /** The provider integration events are delivered to: the broker in `main.ts`, the process itself for the tools and most tests. */
  readonly events: EventProvider;
  /** Where log entries go; left out, the application writes nothing. */
  readonly log?: LogSettings;
  /** The policy around every adapter that leaves the process; left out, the defaults of `resilience.ts`. */
  readonly resilience?: ResilienceSettings;
{{#if cache.redis}}
  /** The Redis protocol server; left out, the cache and the limiter stay in the memory of the process. */
  readonly redis?: RedisServices;
{{/if}}
}

/** Wraps an adapter from outside: a span for its kind and, for what leaves the process, the default policy unless it states its own. */
type Adapt = <T extends object>(instance: T, info: AspectInfo) => T;

/** The technical capabilities every context receives. */
export interface Platform {
  // The in-process buses: contexts register their handlers on them, routes and consumers
  // only see the CommandBus and QueryBus ports.
  readonly commands: InMemoryCommandBus;
  readonly queries: InMemoryQueryBus;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly domainEvents: DomainEventDispatcher;
  /** What use cases publish through. */
  readonly publisher: IntegrationEventPublisher;
  readonly subscriber: IntegrationEventSubscriber;
{{#if broker.external}}
  /** The subscriber of one consuming context: a broker gives each context queues of its own. */
  subscriberFor(context: string): IntegrationEventSubscriber;
{{/if}}
  /** The provider itself: what the outbox relay delivers to. */
  readonly eventBus: IntegrationEventPublisher;
  readonly persistence: Persistence;
  /** Asks the policies about one element, then the authorizer: for the rules that need loaded state. */
  readonly access: Access;
  /**
   * The work in progress (correlation id, actor, tenant), for infrastructure only: audit
   * columns, tenant scoping, consumed events. Use cases get the actor in their message.
   */
  readonly scope: ExecutionScope;
  /** The actor of the execution scope, for an adapter written against `ActorContext`. */
  readonly actors: ActorContext;
  readonly logger: Logger;
  readonly metrics: Metrics;
  readonly cache: Cache;
{{#if cache.rateLimit}}
  readonly rateLimiter: RateLimiter;
{{/if}}
  readonly adapter: Adapt;
  /** The same, for an adapter that states its own policy, as aspects or as decorators on its class. */
  readonly selfGoverned: Adapt;
  readonly protection: UseCaseProtection;
{{#if audit.on}}
  readonly audit: Audit;
{{/if}}
}

/** Replacing a provider (another broker, another clock) happens here and nowhere else. */
export function createPlatform(persistence: Persistence, options: PlatformOptions): Platform {
  const foundations = lay(persistence, options);
  const { clock, logger, metrics, scope } = foundations;
  const authorizer = createAuthorizer();
{{#if audit.on}}
  const onDecision = foundations.audit.decisions;
{{/if}}
{{#unless audit.on}}
  const onDecision = logDecisions(logger);
{{/unless}}
  const protection = new UseCaseProtection(authorizer, onDecision);
  const adapter = adapterAspects(options.resilience ?? DEFAULT_RESILIENCE);
  const observed = [loggingMiddleware(logger), metricsMiddleware(metrics), protection.guard];
  return {
    ...foundations,
    ...eventsOn(persistence, options, scope),
    // Around every use case, outermost first: its log entry, its measure, the permission; a command then runs in the unit of work.
    commands: chain(new InMemoryCommandBus(), [...observed, ...beforeTheTransaction(foundations, options), unitOfWorkMiddleware(persistence.unitOfWork)]),
    queries: chain(new InMemoryQueryBus(), [...observed{{#if audit.on}}, foundations.audit.queries{{/if}}]),
    domainEvents: new InMemoryDomainEventDispatcher(),
    persistence,
    access: new Access({ authorizer, clock, policies: accessPolicies, onDecision }),
    actors: new ScopedActorContext(scope, foundations.ids),
    adapter,
    selfGoverned: (instance, info) => adapter(ownPolicy()(instance, info), info),
    protection,
  };
}

type Foundations = Pick<Platform, 'scope' | 'clock' | 'ids' | 'logger' | 'metrics' | 'cache'{{#if cache.rateLimit}} | 'rateLimiter'{{/if}}{{#if audit.on}} | 'audit'{{/if}}>;

/** What exists before anything else: one execution scope, one clock and one generator for the whole application. */
function lay(persistence: Persistence, options: PlatformOptions): Foundations {
  const scope = new AsyncLocalStorageExecutionScope();
  const clock = new SystemClock();
  const ids = new UuidGenerator();
  const metrics = createMetrics();
  return {
    scope,
    clock,
    ids,
    logger: createLogger(scope, options.log),
    metrics,
{{#if cache.redis}}
    cache: options.redis?.cache(metrics) ?? new InMemoryCache(clock),
{{/if}}
{{#unless cache.redis}}
    cache: new InMemoryCache(clock),
{{/unless}}
{{#if cache.rateLimit}}
    rateLimiter: options.redis?.rateLimiter ?? new InMemoryRateLimiter(clock),
{{/if}}
{{#if audit.on}}
    audit: createAudit(persistence, { scope, clock, ids }),
{{/if}}
  };
}

type Events = Pick<Platform, 'publisher' | 'subscriber' | 'eventBus'{{#if broker.external}} | 'subscriberFor'{{/if}}>;

/** Use cases publish with the correlation id of the work in progress, so everything one request causes is found again. */
function eventsOn(persistence: Persistence, { events }: PlatformOptions, scope: ExecutionScope): Events {
  const eventBus = tracedPublisher(events.bus);
  return {
{{#if events.outbox}}
    publisher: scopedPublisher(new OutboxPublisher(persistence.outbox), scope),
{{/if}}
{{#unless events.outbox}}
    publisher: scopedPublisher(eventBus, scope),
{{/unless}}
    subscriber: tracedSubscriber(events.bus),
{{#if broker.external}}
    subscriberFor: (context) => tracedSubscriber(events.subscriberFor(context)),
{{/if}}
    eventBus,
  };
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
