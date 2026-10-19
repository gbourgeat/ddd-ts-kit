import type { KafkaJS } from '@confluentinc/kafka-javascript';

/** A record as a partition keeps it: its offset, and what the producer sent, as bytes. */
export interface StoredRecord {
  readonly offset: bigint;
  readonly key: Buffer | null;
  readonly value: Buffer | null;
  readonly headers: KafkaJS.IHeaders;
  readonly timestamp: string;
}

/** A topic: an ordered log per partition, never compacted, never truncated. */
export class Topic {
  readonly partitions: StoredRecord[][];

  private nextPartition = 0;

  /** A topic is listed by the metadata a moment after its creation, not at once. */
  visible = false;

  constructor(
    readonly name: string,
    partitions: number,
  ) {
    this.partitions = Array.from({ length: Math.max(partitions, 1) }, () => []);
  }

  /** The partition a record goes to: its own, the one of its key, or the next one in turn. */
  partitionOf(key: Buffer | null, partition: number | undefined): number {
    if (partition !== undefined) {
      return partition;
    }

    if (key === null) {
      this.nextPartition = (this.nextPartition + 1) % this.partitions.length;

      return this.nextPartition;
    }

    return hash(key) % this.partitions.length;
  }

  append(partition: number, record: Omit<StoredRecord, 'offset'>): bigint {
    const log = this.partitions[partition] ?? [];
    const offset = BigInt(log.length);

    log.push({ ...record, offset });

    return offset;
  }

  recordAt(partition: number, offset: bigint): StoredRecord | undefined {
    return this.partitions[partition]?.[Number(offset)];
  }

  /** The offset the next record of a partition will get: its high watermark. */
  endOf(partition: number): bigint {
    return BigInt(this.partitions[partition]?.length ?? 0);
  }
}

/** FNV-1a: the same key always lands on the same partition. */
function hash(bytes: Buffer): number {
  let value = 0x811c9dc5;

  for (const byte of bytes) {
    value = Math.imul(value ^ byte, 0x01000193) >>> 0;
  }

  return value;
}
