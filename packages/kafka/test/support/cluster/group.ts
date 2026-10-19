import type { KafkaJS } from '@confluentinc/kafka-javascript';

/** A member of a consumer group, as the group hands it partitions. */
export interface GroupMember {
  readonly id: number;
  readonly topics: ReadonlySet<string>;
  /** The partitions it gives back, before the group shares them out again. */
  revoke(): void;
  assign(partitions: readonly KafkaJS.TopicPartition[]): void;
}

/**
 * A consumer group: its members, the offsets it committed, and the eager rebalance that shares
 * the partitions of each topic out between the members subscribed to it, as the range assignor
 * does. The cluster tells it the partitions each topic has.
 */
export class Group {
  readonly members = new Map<number, GroupMember>();

  readonly committed = new Map<string, bigint>();

  private pending = false;

  constructor(
    readonly id: string,
    private readonly partitionsOf: (topic: string) => number,
  ) {}

  join(member: GroupMember): void {
    this.members.set(member.id, member);
    this.rebalance();
  }

  leave(member: GroupMember): void {
    if (this.members.delete(member.id)) {
      this.rebalance();
    }
  }

  commit(topic: string, partition: number, offset: bigint): void {
    this.committed.set(positionKey(topic, partition), offset);
  }

  committedOffset(topic: string, partition: number): bigint | undefined {
    return this.committed.get(positionKey(topic, partition));
  }

  /** On the next turn, as a coordinator answers: every change of this turn in one rebalance. */
  rebalance(): void {
    if (this.pending) {
      return;
    }

    this.pending = true;

    setImmediate(() => {
      this.pending = false;
      this.shareOut();
    });
  }

  private shareOut(): void {
    const members = [...this.members.values()].sort((left, right) => left.id - right.id);
    const shares = new Map<number, KafkaJS.TopicPartition[]>(members.map((member) => [member.id, []]));
    const topics = new Set(members.flatMap((member) => [...member.topics]));

    for (const member of members) {
      member.revoke();
    }

    for (const topic of [...topics].sort()) {
      const subscribed = members.filter((member) => member.topics.has(topic));
      const count = this.partitionsOf(topic);

      for (let partition = 0; partition < count; partition += 1) {
        const owner = subscribed[Math.floor((partition * subscribed.length) / count)];

        shares.get(owner?.id ?? -1)?.push({ topic, partition });
      }
    }

    for (const member of members) {
      member.assign(shares.get(member.id) ?? []);
    }
  }
}

export function positionKey(topic: string, partition: number): string {
  return `${topic}\u0000${String(partition)}`;
}
