import type { DomainEvent } from '../../domain/domain-event.js';
import type { DomainEventCallback } from '../events/domain-event-callback.js';

/**
 * In-context, synchronous-in-transaction reactions. Cross-context reactions use IntegrationEvents.
 * Use cases do not depend on it: the save of a repository dispatches what the aggregate recorded.
 */
export abstract class DomainEventDispatcher {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.DomainEventDispatcher' });
  }

  abstract dispatch(events: readonly DomainEvent[]): Promise<void>;

  abstract on(name: string, handler: DomainEventCallback): void;
}
