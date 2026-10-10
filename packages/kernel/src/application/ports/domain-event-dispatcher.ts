import type { DomainEvent } from '../../domain/domain-event.js';
import type { DomainEventCallback } from '../events/domain-event-callback.js';

/** In-context, synchronous-in-transaction reactions. Cross-context reactions use IntegrationEvents. */
export abstract class DomainEventDispatcher {
  static readonly tokenKey = 'kernel.DomainEvents';

  abstract dispatch(events: readonly DomainEvent[]): Promise<void>;

  abstract on(name: string, handler: DomainEventCallback): void;
}
