import type { ProcessedEventStore } from '@ddd-ts-kit/kernel';

/**
 * A processed-event store that can take a mark back. A store that is not transactional needs
 * it: with no rollback to erase the mark of a handler that failed, the redelivery would be
 * skipped and the event lost.
 *
 * It narrows the `ProcessedEventStore` port, whose `release` is optional, and is not a port
 * itself: a composition root binds its store under `ProcessedEventStore`.
 */
export interface ReleasableProcessedEventStore extends ProcessedEventStore {
  /** Forgets `(consumer, eventId)`: the next delivery is handled again. */
  release(consumer: string, eventId: string): Promise<void>;
}
