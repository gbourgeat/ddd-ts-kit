import type {
  Clock,
  CommandBus,
  EventBus,
  IdGenerator,
  IntegrationEventPublisher,
  IntegrationEventSubscriber,
  ProcessedEventStore,
  QueryBus,
  UnitOfWork,
} from '@ddd-ts-kit/kernel';
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
];
