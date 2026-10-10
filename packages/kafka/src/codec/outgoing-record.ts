import type { KafkaJS } from '@confluentinc/kafka-javascript';

/** A record ready to be sent to its topic. */
export interface OutgoingRecord {
  readonly topic: string;
  readonly message: KafkaJS.Message;
}
