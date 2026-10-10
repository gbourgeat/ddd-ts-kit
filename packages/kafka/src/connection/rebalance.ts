import type { KafkaJS } from '@confluentinc/kafka-javascript';

/** Partitions a consumer group gave to a member, or took back from it. */
export interface Rebalance {
  readonly assigned: boolean;
  readonly partitions: readonly KafkaJS.TopicPartition[];
}
