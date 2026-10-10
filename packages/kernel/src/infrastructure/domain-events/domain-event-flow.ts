import { AsyncLocalStorage } from 'node:async_hooks';
import type { DomainEvent } from '../../domain/domain-event.js';

/** One event waiting for its turn, and how to dispatch it where it was recorded. */
export interface AnnouncedEvent {
  readonly event: DomainEvent;
  readonly dispatch: (event: DomainEvent) => Promise<void>;
}

/** The events one save announced and those their handlers announced in turn, oldest first. */
export interface DomainEventFlow {
  readonly waiting: AnnouncedEvent[];
  /** False once the save that opened the flow has dispatched everything: a late save opens its own. */
  open: boolean;
}

// Follows the asynchronous call chain of the save that opened it: concurrent commands never share a flow.
export const domainEventFlow = new AsyncLocalStorage<DomainEventFlow | undefined>();
