import type { ProcessedEventStore } from '@ddd-ts-kit/kernel';
import type { TransactionalMemory } from './transactional-memory.js';

/** Writes on the current transaction, as a SQL adapter does: no way to take a mark back. */
export class TransactionalProcessedEventStore implements ProcessedEventStore {
  constructor(private readonly memory: TransactionalMemory) {}

  async markProcessed(consumer: string, eventId: string): Promise<boolean> {
    const key = JSON.stringify([consumer, eventId]);
    const { processed } = this.memory.state();

    if (processed.has(key)) {
      return false;
    }

    processed.add(key);

    return true;
  }
}
