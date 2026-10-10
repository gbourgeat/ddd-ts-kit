import type { ReleasableProcessedEventStore } from './releasable-processed-event-store.js';

/** Reference releasable store, for tests and single-process apps without a database. */
export class InMemoryReleasableProcessedEventStore implements ReleasableProcessedEventStore {
  private readonly seen = new Set<string>();

  async markProcessed(consumer: string, eventId: string): Promise<boolean> {
    const key = keyOf(consumer, eventId);

    if (this.seen.has(key)) {
      return false;
    }

    this.seen.add(key);

    return true;
  }

  async release(consumer: string, eventId: string): Promise<void> {
    this.seen.delete(keyOf(consumer, eventId));
  }
}

// JSON keeps the pair unambiguous: 'a:b' + 'c' must not equal 'a' + 'b:c'.
function keyOf(consumer: string, eventId: string): string {
  return JSON.stringify([consumer, eventId]);
}
