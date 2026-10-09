import type {
  Cache,
  Clock,
  CommandBus,
  EventBus,
  ExecutionScope,
  IdGenerator,
  IntegrationEventPublisher,
  IntegrationEventSubscriber,
  Logger,
  Metrics,
  ProcessedEventStore,
  QueryBus,
  UnitOfWork,
} from '@ddd-ts-kit/kernel';
import { ACTOR_CONTEXT } from './authorization.js';
import { token, type Token } from './token.js';

export const CLOCK = token<Clock>('kernel.Clock');
export const ID_GENERATOR = token<IdGenerator>('kernel.IdGenerator');
export const UNIT_OF_WORK = token<UnitOfWork>('kernel.UnitOfWork');
export const COMMAND_BUS = token<CommandBus>('kernel.CommandBus');
export const QUERY_BUS = token<QueryBus>('kernel.QueryBus');
export const EVENT_BUS = token<EventBus>('kernel.EventBus');
/** What use cases publish through. The event bus by default, an outbox once there is a database. */
export const EVENT_PUBLISHER = token<IntegrationEventPublisher>('kernel.EventPublisher');
/** What `builder.on(...)` subscribes to. The event bus by default, a broker adapter otherwise. */
export const EVENT_SUBSCRIBER = token<IntegrationEventSubscriber>('kernel.EventSubscriber');
/** When bound, every consumer declared with `builder.on(...)` handles a redelivered event once. */
export const PROCESSED_EVENTS = token<ProcessedEventStore>('kernel.ProcessedEventStore');
/**
 * The execution context of the work in progress, for infrastructure and cross-cutting code
 * only. `ACTOR_CONTEXT` reads its actor from it by default, so the two cannot disagree.
 */
export const EXECUTION_SCOPE = token<ExecutionScope>('kernel.ExecutionScope');
/** Structured logging. Writes nothing until the platform rebinds it. */
export const LOGGER = token<Logger>('kernel.Logger');
/** Counters, histograms and gauges. Measures nothing until the platform rebinds it. */
export const METRICS = token<Metrics>('kernel.Metrics');
/** In the memory of the process until the platform rebinds it. */
export const CACHE = token<Cache>('kernel.Cache');

export const KERNEL_TOKENS: readonly Token<unknown>[] = [
  CLOCK,
  ID_GENERATOR,
  UNIT_OF_WORK,
  COMMAND_BUS,
  QUERY_BUS,
  EVENT_BUS,
  EVENT_PUBLISHER,
  EVENT_SUBSCRIBER,
  PROCESSED_EVENTS,
  ACTOR_CONTEXT,
  EXECUTION_SCOPE,
  LOGGER,
  METRICS,
  CACHE,
];
