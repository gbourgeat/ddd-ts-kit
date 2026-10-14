import type { DomainEventPhase } from '../../application/events/domain-event-phase.js';
import type { DomainEvent } from '../../domain/domain-event.js';
import type { ClassDeclarator } from '../dependencies/class-declarator.js';
import type { DeclaredDependencies } from '../dependencies/declared-dependencies.js';
import type { DependenciesFromSignature } from '../dependencies/dependencies-from-signature.js';
import type { DomainEventHandler as DomainEventHandlerShape } from '../model/domain-event-handler.js';
import type { NamedDomainEventType } from '../model/named-domain-event-type.js';
import { record } from '../registry/record.js';
import { eventNameOf } from './event-name-of.js';
import { isDependencies } from './is-dependencies.js';
import type { Named } from './named.js';
import type { Settings } from './settings.js';

export interface DomainEventHandlerOptions {
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
 * recorded the event, before the commit: `@DomainEventHandler(OrderPaid)`. It is attached under
 * the name the event class declares once (`static readonly eventName = 'ordering.order.paid'`).
 * One whose effect is outside the transaction runs after it:
 * `@DomainEventHandler(OrderPaid, { phase: 'after-commit' })`.
 */
export function DomainEventHandler<
  E extends DomainEvent,
  const Name extends string,
  const D extends DeclaredDependencies = DependenciesFromSignature,
>(
  event: NamedDomainEventType<E, Name> & Named<Name, 'eventName'>,
  dependencies?: D,
): ClassDeclarator<DomainEventHandlerShape<E>, D>;
export function DomainEventHandler<
  E extends DomainEvent,
  const Name extends string,
  const D extends DeclaredDependencies = DependenciesFromSignature,
>(
  event: NamedDomainEventType<E, Name> & Named<Name, 'eventName'>,
  options: DomainEventHandlerOptions,
  dependencies?: D,
): ClassDeclarator<DomainEventHandlerShape<E>, D>;

export function DomainEventHandler<E extends DomainEvent, D extends DeclaredDependencies>(
  event: NamedDomainEventType<E>,
  ...[first, second]: Settings<DomainEventHandlerOptions, D>
): ClassDeclarator<DomainEventHandlerShape<E>, D> {
  const name = eventNameOf(event, 'A handler');
  const phase = (isDependencies(first) ? undefined : first?.phase) ?? 'before-commit';
  const dependencies: DeclaredDependencies = isDependencies(first) ? first : second;

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
