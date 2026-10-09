import type { Actor } from '../application/actor.js';
import type { IntegrationEvent } from '../application/integration-event.js';
import type { DomainEvent } from '../domain/domain-event.js';
import type { DomainEventReaction, DomainEventType, EventConsumer, EventContract } from './declaration.js';
import type { ClassDeclarator, Dependencies } from './dependencies.js';
import { DeclarationError, record } from './registry.js';

/** Refuses the empty string for the option `Key`: a name is written, never left blank. */
export type Named<Name extends string, Key extends string> = Name extends ''
  ? { readonly [K in Key]: never }
  : unknown;

export interface EventListenerOptions<Name extends string = string> {
  /**
   * Stable name of the consumer, `<context>.<reaction>`: the idempotency scope, and the system
   * actor the listener runs as. It must survive the renaming of the class.
   */
  readonly consumer: Name;
  /**
   * The actor an event names, for a project whose envelopes carry a reference to one. The
   * listener then runs as that actor instead of the system actor of the consumer.
   */
  readonly actorOf?: (event: IntegrationEvent) => Actor | undefined;
}

/**
 * A consumer of an integration event of another context:
 * `@EventListener(OrderPlaced, { consumer: 'billing.invoice-on-order-placed' }, [COMMAND_BUS])`.
 */
export function EventListener<Payload, const Name extends string, const D extends Dependencies = readonly []>(
  contract: EventContract<Payload>,
  options: EventListenerOptions<Name> & Named<Name, 'consumer'>,
  dependencies?: D,
): ClassDeclarator<EventConsumer<Payload>, D> {
  const { consumer, actorOf } = options;
  assertNamed(consumer, 'An event listener needs a consumer name');
  return (target) => {
    record(target, {
      role: 'event-listener',
      event: { type: contract.type, version: contract.version },
      consumer,
      ...(actorOf === undefined ? {} : { actorOf }),
      dependencies: dependencies ?? [],
      pair: (use) => use(contract, target),
    });
  };
}

export interface DomainEventListenerOptions<Name extends string = string> {
  /** The `name` the events of this type carry, `<context>.<aggregate>.<fact>`: what the dispatcher routes by. */
  readonly name: Name;
}

/**
 * A reaction to a domain event of its own context, run where the event is dispatched:
 * `@DomainEventListener(OrderPaid, { name: 'ordering.order.paid' }, [COMMAND_BUS])`.
 */
export function DomainEventListener<
  E extends DomainEvent,
  const Name extends string,
  const D extends Dependencies = readonly [],
>(
  event: DomainEventType<E>,
  options: DomainEventListenerOptions<Name> & Named<Name, 'name'>,
  dependencies?: D,
): ClassDeclarator<DomainEventReaction<E>, D> {
  const { name } = options;
  assertNamed(name, `A listener of ${event.name} needs the name its events carry`);
  return (target) => {
    record(target, {
      role: 'domain-event-listener',
      name,
      event,
      dependencies: dependencies ?? [],
      pair: (use) => use(event, target),
    });
  };
}

function assertNamed(name: string, complaint: string): void {
  if (name.trim() === '') throw new DeclarationError(`${complaint}, and it is empty.`);
}
