import type { ProcessedEventStore } from '@ddd-ts-kit/kernel';
import { TransactionalJournal } from './transactional-journal.js';

/**
 * A processed-event store whose mark shares the transaction of the handler, as a table of the
 * same database does: it has no `release`, a failed unit of work takes the mark back, and a
 * mark asked outside a unit of work is refused.
 */
export class TransactionalProcessedEvents extends TransactionalJournal implements ProcessedEventStore {
  constructor() {
    super('A processed-event mark');
  }

  async markProcessed(consumer: string, eventId: string): Promise<boolean> {
    const mark = `${consumer} ${eventId}`;

    if (this.has(mark)) {
      return false;
    }

    this.write(mark);

    return true;
  }
}
