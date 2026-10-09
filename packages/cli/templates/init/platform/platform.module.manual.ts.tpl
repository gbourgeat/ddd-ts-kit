import { Access } from '@ddd-ts-kit/auth';
import {
  AsyncLocalStorageActorContext,
  InMemoryCommandBus,
  InMemoryDomainEventDispatcher,
  InMemoryQueryBus,
  SystemClock,
  UuidGenerator,
  unitOfWorkMiddleware,
  type ActorContext,
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
import { accessPolicies } from './auth/access-policies.js';
import { auditDecision } from './auth/audit.js';
import { UseCaseProtection } from './auth/authorization.js';
import { createAuthorizer } from './auth/authorizer.js';
import type { Persistence } from './database/persistence.js';
import type { EventProvider } from './events.js';

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
  /** Who acts, for infrastructure only (audit columns, tenant scoping); use cases get the actor in their message. */
  readonly actors: ActorContext;
  readonly protection: UseCaseProtection;
}

/** Replacing a provider (another broker, another clock) happens here and nowhere else. */
export function createPlatform(persistence: Persistence, events: EventProvider): Platform {
  const { bus } = events;
  const eventBus = tracedPublisher(bus);
  const clock = new SystemClock();
  const authorizer = createAuthorizer();
  const protection = new UseCaseProtection(authorizer);
  return {
    commands: new InMemoryCommandBus().use(protection.guard).use(unitOfWorkMiddleware(persistence.unitOfWork)),
    queries: new InMemoryQueryBus().use(protection.guard),
    clock,
    ids: new UuidGenerator(),
    domainEvents: new InMemoryDomainEventDispatcher(),
{{#if events.outbox}}
    publisher: new OutboxPublisher(persistence.outbox),
{{/if}}
{{#unless events.outbox}}
    publisher: eventBus,
{{/unless}}
    subscriber: tracedSubscriber(bus),
{{#if broker.external}}
    subscriberFor: (context) => tracedSubscriber(events.subscriberFor(context)),
{{/if}}
    eventBus,
    persistence,
    access: new Access({ authorizer, clock, policies: accessPolicies, onDecision: auditDecision }),
    actors: new AsyncLocalStorageActorContext(),
    protection,
  };
}
