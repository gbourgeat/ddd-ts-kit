import type { KafkaJS } from '@confluentinc/kafka-javascript';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import type { BrokerLink } from './broker-link.js';
import { encode, type OutgoingRecord, type Routing } from './codec.js';
import { PublishNotAcknowledgedError, failureCode, reasonOf } from './errors.js';
import type { TopicDescription } from './topology.js';

export interface PublicationSettings {
  readonly routing: Routing;
  readonly describe: (topic: string) => TopicDescription;
  readonly failed: (code: string) => void;
}

interface Send {
  readonly topic: string;
  readonly messages: KafkaJS.Message[];
  readonly eventIds: string[];
}

/**
 * Publishing with an idempotent producer and `acks=all`: a publication succeeds only once
 * every in-sync replica has the record, which is what lets an outbox relay mark it published.
 */
export class Publications {
  #producer: Promise<KafkaJS.Producer> | undefined;

  constructor(
    private readonly link: BrokerLink,
    private readonly settings: PublicationSettings,
  ) {}

  /** Resolves when every event is acknowledged; rejects with the first failure otherwise. */
  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    const sends = sendsOf(events, this.settings.routing);
    await this.link.declare(sends.map((send) => this.settings.describe(send.topic)));
    const outcomes = await Promise.allSettled(sends.map((send) => this.#deliver(send)));
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        throw outcome.reason;
      }
    }
  }

  /** One record to a topic that exists, acknowledged like a publication. */
  async send({ topic, message }: OutgoingRecord): Promise<void> {
    await this.#deliver({ topic, messages: [message], eventIds: [] });
  }

  /** Lets the acknowledgements in flight arrive, then disconnects. */
  async close(): Promise<void> {
    const producer = await this.#producer?.catch(ignore);
    this.#producer = undefined;
    await producer?.disconnect().catch(ignore);
  }

  async #deliver({ topic, messages, eventIds }: Send): Promise<void> {
    const producer = await this.#connected();
    try {
      await producer.send({ topic, messages });
    } catch (error) {
      if (isFatal(error)) {
        this.#drop(producer);
      }
      throw new PublishNotAcknowledgedError(eventIds, failureCode(error));
    }
  }

  async #connected(): Promise<KafkaJS.Producer> {
    this.#producer ??= this.link.connected(this.link.producer());
    try {
      return await this.#producer;
    } catch (error) {
      this.#producer = undefined;
      this.settings.failed(reasonOf(error));
      throw error;
    }
  }

  // After a fatal error the producer refuses every send: the next publication opens another.
  #drop(producer: KafkaJS.Producer): void {
    this.#producer = undefined;
    void producer.disconnect().catch(ignore);
  }
}

/** One send per topic, in the order of the batch: the records of a key keep their order. */
function sendsOf(events: readonly IntegrationEvent[], routing: Routing): Send[] {
  const sends = new Map<string, Send>();
  for (const event of events) {
    const { topic, message } = encode(event, routing);
    const send = sends.get(topic) ?? { topic, messages: [], eventIds: [] };
    send.messages.push(message);
    send.eventIds.push(event.id);
    sends.set(topic, send);
  }
  return [...sends.values()];
}

function isFatal(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'fatal' in error && error.fatal === true;
}

function ignore(): undefined {
  return undefined;
}
