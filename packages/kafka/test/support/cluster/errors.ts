import { KafkaJS } from '@confluentinc/kafka-javascript';

type ErrorName = keyof typeof KafkaJS.ErrorCodes;

/** An error as the client raises it: its `type` is the librdkafka name of its code; a fatal one ends its producer. */
export function kafkaError(name: ErrorName, message: string, { fatal = false } = {}): KafkaJS.KafkaJSError {
  return new KafkaJS.KafkaJSError(message, { code: KafkaJS.ErrorCodes[name], fatal });
}

export class Unsupported extends Error {
  constructor(operation: string) {
    super(`${operation} is not supported by the in-memory cluster`);
  }
}
