import type { Options } from 'amqplib';

/** A message ready to be sent: its body and its AMQP properties. */
export interface Publication {
  readonly content: Buffer;
  readonly properties: Options.Publish;
}
