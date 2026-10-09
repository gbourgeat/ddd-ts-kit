import {
  InMemoryCommandBus,
  InMemoryDomainEventDispatcher,
  InMemoryEventBus,
  InMemoryQueryBus,
  SystemClock,
  UuidGenerator,
  unitOfWorkMiddleware,
  type Clock,
  type DomainEventDispatcher,
  type IdGenerator,
  type IntegrationEventPublisher,
  type IntegrationEventSubscriber,
} from '@ddd-ts-kit/kernel';
{{#if events.outbox}}
import { OutboxPublisher } from '@ddd-ts-kit/events';
{{/if}}
import { tracedPublisher, tracedSubscriber } from '@ddd-ts-kit/tracing';
import type { Persistence } from './database/persistence.js';

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
  /** The provider itself: what the outbox relay delivers to. */
  readonly eventBus: IntegrationEventPublisher;
  readonly persistence: Persistence;
}

/** Replacing a provider (another broker, another clock) happens here and nowhere else. */
export function createPlatform(persistence: Persistence): Platform {
  const bus = new InMemoryEventBus();
  const eventBus = tracedPublisher(bus);
  return {
    commands: new InMemoryCommandBus().use(unitOfWorkMiddleware(persistence.unitOfWork)),
    queries: new InMemoryQueryBus(),
    clock: new SystemClock(),
    ids: new UuidGenerator(),
    domainEvents: new InMemoryDomainEventDispatcher(),
{{#if events.outbox}}
    publisher: new OutboxPublisher(persistence.outbox),
{{/if}}
{{#unless events.outbox}}
    publisher: eventBus,
{{/unless}}
    subscriber: tracedSubscriber(bus),
    eventBus,
    persistence,
  };
}
