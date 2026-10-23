import type { IncomingRecord } from '../codec/incoming-record';

interface FailedRecord {
  readonly offset: string;
  readonly failures: number;
}

/**
 * How many times the record at the head of each partition has failed. Kept in memory: a
 * consumer that restarts, or takes a partition over, starts the count again.
 */
export class Attempts {
  private readonly failedHeads = new Map<string, FailedRecord>();

  /** Which delivery of the record this is, starting at 1. */
  of(record: IncomingRecord): number {
    const failed = this.failedHeads.get(partitionKey(record));

    return failed?.offset === record.message.offset ? failed.failures + 1 : 1;
  }

  failed(record: IncomingRecord): void {
    const failures = this.of(record);

    this.failedHeads.set(partitionKey(record), { offset: record.message.offset, failures });
  }

  forget(partition: { readonly topic: string; readonly partition: number }): void {
    this.failedHeads.delete(partitionKey(partition));
  }
}

function partitionKey({ topic, partition }: { readonly topic: string; readonly partition: number }): string {
  return `${topic}/${String(partition)}`;
}
