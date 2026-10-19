import { KafkaJS } from '@confluentinc/kafka-javascript';

type ErrorName = keyof typeof KafkaJS.ErrorCodes;

/** An error as the client raises it: its `type` is the librdkafka name of its code. */
export function kafkaError(name: ErrorName, message: string): KafkaJS.KafkaJSError {
  return new KafkaJS.KafkaJSError(message, { code: KafkaJS.ErrorCodes[name] });
}

export class Unsupported extends Error {
  constructor(operation: string) {
    super(`${operation} is not supported by the in-memory cluster`);
  }
}
