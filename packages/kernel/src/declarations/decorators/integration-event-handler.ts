import type { Actor } from '../../application/actor/actor';
import type { IntegrationEvent } from '../../application/events/integration-event';
import type { ClassDeclarator } from '../dependencies/class-declarator';
import type { DeclaredDependencies } from '../dependencies/declared-dependencies';
import type { DependenciesFromSignature } from '../dependencies/dependencies-from-signature';
import type { EventContract } from '../model/event-contract';
import type { IntegrationEventHandler as IntegrationEventHandlerShape } from '../model/integration-event-handler';
import { record } from '../registry/record';
import { assertNamed } from './assert-named';
import type { Named } from './named';

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
 * `@IntegrationEventHandler(OrderPlaced, { consumer: 'billing.invoice-on-order-placed' })`.
 */
export function IntegrationEventHandler<
  Payload,
  const Name extends string,
  const D extends DeclaredDependencies = DependenciesFromSignature,
>(
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
      dependencies,
      pair: (use) => use(contract, target),
    });
  };
}
