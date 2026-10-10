import type { IncomingRecord } from './codec.js';

interface FailedRecord {
  readonly offset: string;
  readonly failures: number;
}

/**
 * How many times the record at the head of each partition has failed. Kept in memory: a
 * consumer that restarts, or takes a partition over, starts the count again.
 */
export class Attempts {
  readonly #failed = new Map<string, FailedRecord>();

  /** Which delivery of the record this is, starting at 1. */
  of(record: IncomingRecord): number {
    const failed = this.#failed.get(partitionKey(record));
    return failed?.offset === record.message.offset ? failed.failures + 1 : 1;
  }

  failed(record: IncomingRecord): void {
    const failures = this.of(record);
    this.#failed.set(partitionKey(record), { offset: record.message.offset, failures });
  }

  forget(partition: { readonly topic: string; readonly partition: number }): void {
    this.#failed.delete(partitionKey(partition));
  }
}

function partitionKey({ topic, partition }: { readonly topic: string; readonly partition: number }): string {
  return `${topic}/${String(partition)}`;
}
