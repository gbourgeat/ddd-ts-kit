import { jetstream, type JetStreamClient } from '@nats-io/jetstream';
import type { NatsConnection } from '@nats-io/transport-node';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { encode, type Publication } from './codec.js';
import { BrokerUnavailableError, PublishNotAcknowledgedError, failureCode } from './errors.js';

export interface PublicationSettings {
  readonly subjectPrefix: string;
  readonly publishTimeoutMs: number;
}

/**
 * Publishing to JetStream: a publication succeeds only once the stream acknowledged the
 * message as stored, which is what lets an outbox relay mark it published. The event id is
 * the message id of the stream, so a second publication of the same event inside the
 * duplicate window is acknowledged and dropped.
 */
export class Publications {
  #client: JetStreamClient | undefined;

  constructor(private readonly settings: PublicationSettings) {}

  attach(connection: NatsConnection): void {
    this.#client = jetstream(connection);
  }

  detach(): void {
    this.#client = undefined;
  }

  /** Resolves when every event is acknowledged; rejects with the first failure otherwise. */
  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    const outcomes = await Promise.allSettled(
      events.map((event) => this.send(`${this.settings.subjectPrefix}.${event.type}`, encode(event))),
    );
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        throw outcome.reason;
      }
    }
  }

  /** One message to a subject a stream captures, acknowledged by that stream. */
  async send(subject: string, { data, messageId, headers }: Publication): Promise<void> {
    if (this.#client === undefined) {
      throw new BrokerUnavailableError('RECONNECTING');
    }
    const timeout = this.settings.publishTimeoutMs;
    try {
      await this.#client.publish(subject, data, { msgID: messageId, headers, timeout });
    } catch (error) {
      throw new PublishNotAcknowledgedError(messageId, failureCode(error));
    }
  }
}
