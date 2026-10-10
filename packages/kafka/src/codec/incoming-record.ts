import type { KafkaJS } from '@confluentinc/kafka-javascript';

/** A record as a consumer receives it. */
export interface IncomingRecord {
  readonly topic: string;
  readonly partition: number;
  readonly message: KafkaJS.KafkaMessage;
}
