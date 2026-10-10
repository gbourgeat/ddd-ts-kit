import type { ActorContext } from '../application/actor.js';
import type { CommandBus, QueryBus } from '../application/bus.js';
import type { Cache } from '../application/cache.js';
import type { DomainEventDispatcher } from '../application/domain-event-dispatcher.js';
import type { ExecutionScope } from '../application/execution-context.js';
import type {
  EventBus,
  IntegrationEventPublisher,
  IntegrationEventSubscriber,
  ProcessedEventStore,
} from '../application/integration-event.js';
import type { JobScheduler } from '../application/job.js';
import type { Lock } from '../application/lock.js';
import type { Logger } from '../application/logger.js';
import type { Metrics } from '../application/metrics.js';
import type { Clock, IdGenerator, UnitOfWork } from '../application/ports.js';
import type { RateLimiter } from '../application/rate-limiter.js';
import { standardToken } from './token.js';

export const CLOCK = standardToken<Clock>('kernel.Clock');
export const ID_GENERATOR = standardToken<IdGenerator>('kernel.IdGenerator');
export const UNIT_OF_WORK = standardToken<UnitOfWork>('kernel.UnitOfWork');
export const COMMAND_BUS = standardToken<CommandBus>('kernel.CommandBus');
export const QUERY_BUS = standardToken<QueryBus>('kernel.QueryBus');
export const EVENT_BUS = standardToken<EventBus>('kernel.EventBus');
/** What use cases publish through. The event bus by default, an outbox once there is a database. */
export const EVENT_PUBLISHER = standardToken<IntegrationEventPublisher>('kernel.EventPublisher');
/** What integration event handlers are subscribed to. The event bus by default, a broker adapter otherwise. */
export const EVENT_SUBSCRIBER = standardToken<IntegrationEventSubscriber>('kernel.EventSubscriber');
/** When bound, every integration event handler handles a redelivered event once. */
export const PROCESSED_EVENTS = standardToken<ProcessedEventStore>('kernel.ProcessedEventStore');
/** Where the domain events of a context are dispatched, and where its domain event handlers are attached. */
export const DOMAIN_EVENTS = standardToken<DomainEventDispatcher>('kernel.DomainEvents');
/**
 * The execution context of the work in progress, for infrastructure and cross-cutting code
 * only. `ACTOR_CONTEXT` reads its actor from it by default, so the two cannot disagree.
 */
export const EXECUTION_SCOPE = standardToken<ExecutionScope>('kernel.ExecutionScope');
/** The actor of the request being processed, for infrastructure only: audit columns, tenant scoping. */
export const ACTOR_CONTEXT = standardToken<ActorContext>('kernel.ActorContext');
/** Structured logging. Writes nothing until the platform rebinds it. */
export const LOGGER = standardToken<Logger>('kernel.Logger');
/** Counters, histograms and gauges. Measures nothing until the platform rebinds it. */
export const METRICS = standardToken<Metrics>('kernel.Metrics');
/** In the memory of the process until the platform rebinds it. */
export const CACHE = standardToken<Cache>('kernel.Cache');
/** Excludes inside this process only until the platform rebinds it. */
export const LOCK = standardToken<Lock>('kernel.Lock');
/** Counts inside this process only until the platform rebinds it. */
export const RATE_LIMITER = standardToken<RateLimiter>('kernel.RateLimiter');
/** Where the declared jobs are registered. In this process, on `CLOCK` and `LOCK`, until the platform rebinds it. */
export const JOB_SCHEDULER = standardToken<JobScheduler>('kernel.JobScheduler');
