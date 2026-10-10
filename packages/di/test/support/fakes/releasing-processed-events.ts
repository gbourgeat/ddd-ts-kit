import type { ProcessedEventStore } from '@ddd-ts-kit/kernel';

/** A store of its own, outside any transaction: it can only give a mark back when asked. */
export class ReleasingProcessedEvents implements ProcessedEventStore {
  readonly marks = new Set<string>();

  readonly released: string[] = [];

  async markProcessed(consumer: string, eventId: string): Promise<boolean> {
    const mark = `${consumer} ${eventId}`;

    if (this.marks.has(mark)) {
      return false;
    }

    this.marks.add(mark);

    return true;
  }

  async release(consumer: string, eventId: string): Promise<void> {
    const mark = `${consumer} ${eventId}`;

    this.marks.delete(mark);
    this.released.push(mark);
  }
}
