import type { Actor } from '../application/actor.js';
import type { IntegrationEvent } from '../application/integration-event.js';
import type { DomainEvent } from '../domain/domain-event.js';
import type {
  DomainEventHandler as DomainEventHandlerShape,
  DomainEventType,
  EventContract,
  IntegrationEventHandler as IntegrationEventHandlerShape,
} from './declaration.js';
import type { ClassDeclarator, Dependencies } from './dependencies.js';
import { DeclarationError, record } from './registry.js';

/** Refuses the empty string for the option `Key`: a name is written, never left blank. */
export type Named<Name extends string, Key extends string> = Name extends ''
  ? { readonly [K in Key]: never }
  : unknown;

export interface IntegrationEventHandlerOptions<Name extends string = string> {
  /**
   * Stable name of the consumer, `<context>.<reaction>`: the idempotency scope, and the system
   * actor the handler runs as. It must survive the renaming of the class.
   */
  readonly consumer: Name;
  /**
   * The actor an event names, for a project whose envelopes carry a reference to one. The
   * handler then runs as that actor instead of the system actor of the consumer.
   */
  readonly actorOf?: (event: IntegrationEvent) => Actor | undefined;
}

/**
 * What the decorated class looks like, under the name of its decorator, so one import serves
 * both: `implements IntegrationEventHandler<OrderPlacedPayload>`.
 */
export type IntegrationEventHandler<Payload> = IntegrationEventHandlerShape<Payload>;

/**
 * The handler of an integration event of another context, subscribed under a stable consumer name:
 * `@IntegrationEventHandler(OrderPlaced, { consumer: 'billing.invoice-on-order-placed' }, [COMMAND_BUS])`.
 */
export function IntegrationEventHandler<Payload, const Name extends string, const D extends Dependencies = readonly []>(
  contract: EventContract<Payload>,
  options: IntegrationEventHandlerOptions<Name> & Named<Name, 'consumer'>,
  dependencies?: D,
): ClassDeclarator<IntegrationEventHandlerShape<Payload>, D> {
  const { consumer, actorOf } = options;
  assertNamed(consumer, 'An integration event handler needs a consumer name');
  return (target) => {
    record(target, {
      role: 'integration-event-handler',
      event: { type: contract.type, version: contract.version },
      consumer,
      ...(actorOf === undefined ? {} : { actorOf }),
      dependencies: dependencies ?? [],
      pair: (use) => use(contract, target),
    });
  };
}

export interface DomainEventHandlerOptions<Name extends string = string> {
  /** The `name` the events of this type carry, `<context>.<aggregate>.<fact>`: what the dispatcher routes by. */
  readonly name: Name;
}

/**
 * What the decorated class looks like, under the name of its decorator, so one import serves
 * both: `implements DomainEventHandler<OrderPaid>`.
 */
export type DomainEventHandler<E extends DomainEvent> = DomainEventHandlerShape<E>;

/**
 * A handler of a domain event of its own context, run where the event is dispatched:
 * `@DomainEventHandler(OrderPaid, { name: 'ordering.order.paid' }, [COMMAND_BUS])`.
 */
export function DomainEventHandler<
  E extends DomainEvent,
  const Name extends string,
  const D extends Dependencies = readonly [],
>(
  event: DomainEventType<E>,
  options: DomainEventHandlerOptions<Name> & Named<Name, 'name'>,
  dependencies?: D,
): ClassDeclarator<DomainEventHandlerShape<E>, D> {
  const { name } = options;
  assertNamed(name, `A handler of ${event.name} needs the name its events carry`);
  return (target) => {
    record(target, {
      role: 'domain-event-handler',
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
