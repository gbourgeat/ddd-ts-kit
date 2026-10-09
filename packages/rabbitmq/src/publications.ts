import type { ChannelModel, ConfirmChannel } from 'amqplib';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { encode, type Publication } from './codec.js';
import { BrokerUnavailableError, PublishNotConfirmedError, UnroutableEventError } from './errors.js';

export interface PublicationSettings {
  readonly exchange: string;
  readonly failOnUnroutable: boolean;
  /** Called when the channel dies while the connection lives. */
  readonly channelLost: () => void;
}

/** Sends a message to a queue through the default exchange and waits for its confirmation. */
export function sendConfirmed(
  channel: ConfirmChannel,
  queue: string,
  publication: Publication,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const confirmed = (error: unknown): void => {
      if (error === null || error === undefined) {
        resolve();
      } else {
        reject(new PublishNotConfirmedError(String(publication.properties.messageId)));
      }
    };
    try {
      channel.sendToQueue(queue, publication.content, publication.properties, confirmed);
    } catch {
      confirmed(new Error('channel closed'));
    }
  });
}

/**
 * Publishing with publisher confirms: a publication succeeds only once the broker has taken
 * responsibility for the message, which is what lets an outbox relay mark it published.
 */
export class Publications {
  readonly #returned = new Set<string>();
  readonly #unconfirmed = new Set<(error: unknown) => void>();
  #channel: ConfirmChannel | undefined;

  constructor(private readonly settings: PublicationSettings) {}

  async attach(model: ChannelModel): Promise<void> {
    const channel = await model.createConfirmChannel();
    channel.on('error', ignore);
    channel.on('close', () => {
      if (this.#channel === channel) {
        this.settings.channelLost();
      }
    });
    channel.on('return', (message) => {
      this.#returned.add(String(message.properties.messageId));
    });
    await channel.assertExchange(this.settings.exchange, 'topic', { durable: true });
    this.#channel = channel;
  }

  /** The channel is gone: what it had not confirmed never will be. */
  detach(): void {
    this.#channel = undefined;
    this.#returned.clear();
    for (const confirmed of [...this.#unconfirmed]) {
      confirmed(new Error('channel lost'));
    }
  }

  /** Resolves when every event is confirmed; rejects with the first failure otherwise. */
  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    const channel = this.#channel;
    if (channel === undefined) {
      throw new BrokerUnavailableError('RECONNECTING');
    }
    const outcomes = await Promise.allSettled(events.map((event) => this.#send(channel, event)));
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        throw outcome.reason;
      }
    }
  }

  /** Lets the confirmations in flight arrive, then closes the channel. */
  async close(): Promise<void> {
    const channel = this.#channel;
    this.#channel = undefined;
    await channel?.waitForConfirms().catch(ignore);
    await channel?.close().catch(ignore);
  }

  #send(channel: ConfirmChannel, event: IntegrationEvent): Promise<void> {
    const { content, properties } = encode(event);
    const options = { ...properties, mandatory: this.settings.failOnUnroutable };
    return new Promise((resolve, reject) => {
      const confirmed = (error: unknown): void => {
        this.#unconfirmed.delete(confirmed);
        // The broker sends the return of an unroutable message before its confirmation.
        if (error !== null && error !== undefined) {
          reject(new PublishNotConfirmedError(event.id));
        } else if (this.#returned.delete(event.id)) {
          reject(new UnroutableEventError(event.id, event.type));
        } else {
          resolve();
        }
      };
      this.#unconfirmed.add(confirmed);
      try {
        channel.publish(this.settings.exchange, event.type, content, options, confirmed);
      } catch {
        confirmed(new Error('channel closed'));
      }
    });
  }
}

function ignore(): undefined {
  return undefined;
}
