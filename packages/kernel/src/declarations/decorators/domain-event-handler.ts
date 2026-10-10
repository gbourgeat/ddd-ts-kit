import type { DomainEvent } from '../../domain/domain-event.js';
import type { ClassDeclarator } from '../dependencies/class-declarator.js';
import type { Dependencies } from '../dependencies/dependencies.js';
import type { DomainEventHandler as DomainEventHandlerShape } from '../model/domain-event-handler.js';
import type { DomainEventType } from '../model/domain-event-type.js';
import { record } from '../registry/record.js';
import { assertNamed } from './assert-named.js';
import type { Named } from './named.js';

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
 * `@DomainEventHandler(OrderPaid, { name: 'ordering.order.paid' }, [CommandBus])`.
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
