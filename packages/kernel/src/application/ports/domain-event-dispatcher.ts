import type { DomainEvent } from '../../domain/domain-event';
import type { DomainEventCallback } from '../events/domain-event-callback';
import type { DomainEventPhase } from '../events/domain-event-phase';
import type { DomainEventSubscription } from '../events/domain-event-subscription';

/**
 * In-context reactions to what the aggregates recorded. Cross-context reactions use
 * IntegrationEvents. Use cases do not depend on it: the save of a repository hands over what the
 * aggregate recorded, and the unit of work dispatches it at its end (`withinUnitOfWork`).
 */
export abstract class DomainEventDispatcher {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.DomainEventDispatcher' });
  }

  /**
   * Runs the handlers of one phase, `before-commit` by default, event after event. Before the
   * commit the first failure rejects. After the commit it never rejects: a failing handler is
   * reported and the next ones still run.
   */
  abstract dispatch(events: readonly DomainEvent[], phase?: DomainEventPhase): Promise<void>;

  abstract on(name: string, handler: DomainEventCallback, subscription?: DomainEventSubscription): void;
}
