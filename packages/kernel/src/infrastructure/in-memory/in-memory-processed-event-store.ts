import type { ProcessedEventStore } from '../../application/ports/processed-event-store';

export class InMemoryProcessedEventStore implements ProcessedEventStore {
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
