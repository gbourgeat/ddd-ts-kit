import type { DomainEventPhase } from '../../application/events/domain-event-phase.js';
import type { DomainEvent } from '../../domain/domain-event.js';
import type { ClassDeclarator } from '../dependencies/class-declarator.js';
import type { DeclaredDependencies } from '../dependencies/declared-dependencies.js';
import type { DependenciesFromSignature } from '../dependencies/dependencies-from-signature.js';
import type { DomainEventHandler as DomainEventHandlerShape } from '../model/domain-event-handler.js';
import type { DomainEventType } from '../model/domain-event-type.js';
import { record } from '../registry/record.js';
import { assertNamed } from './assert-named.js';
import type { Named } from './named.js';

export interface DomainEventHandlerOptions<Name extends string = string> {
  /** The `name` the events of this type carry, `<context>.<aggregate>.<fact>`: what the dispatcher routes by. */
  readonly name: Name;
  /**
   * `before-commit`, the default: at the end of the unit of work, inside its transaction.
   * `after-commit`: once it has committed, for an effect no transaction covers; at most once.
   */
  readonly phase?: DomainEventPhase;
}

/**
 * What the decorated class looks like, under the name of its decorator, so one import serves
 * both: `implements DomainEventHandler<OrderPaid>`.
 */
export type DomainEventHandler<E extends DomainEvent> = DomainEventHandlerShape<E>;

/**
 * A handler of a domain event of its own context, run at the end of the unit of work that
 * recorded the event, before the commit:
 * `@DomainEventHandler(OrderPaid, { name: OrderPaid.eventName })`, the name the event class
 * declares once (`static readonly eventName = 'ordering.order.paid'`). One whose
 * effect is outside the transaction runs after it:
 * `@DomainEventHandler(OrderPaid, { name: OrderPaid.eventName, phase: 'after-commit' })`.
 */
export function DomainEventHandler<
  E extends DomainEvent,
  const Name extends string,
  const D extends DeclaredDependencies = DependenciesFromSignature,
>(
  event: DomainEventType<E>,
  options: DomainEventHandlerOptions<Name> & Named<Name, 'name'>,
  dependencies?: D,
): ClassDeclarator<DomainEventHandlerShape<E>, D> {
  const { name, phase = 'before-commit' } = options;

  assertNamed(name, `A handler of ${event.name} needs the name its events carry`);

  return (target) => {
    record(target, {
      role: 'domain-event-handler',
      name,
      phase,
      event,
      dependencies,
      pair: (use) => use(event, target),
    });
  };
}
