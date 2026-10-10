import { jetstream, jetstreamManager, type JetStreamClient, type JetStreamManager } from '@nats-io/jetstream';
import { connect, type NatsConnection } from '@nats-io/transport-node';
import {
  NatsEventBus,
  bindingNamesOf,
  deadStreamOf,
  type ConsumerBinding,
  type NatsEventBusOptions,
} from '../../src/index.js';
import { MAX_ATTEMPTS, RETRY_DELAY_MS } from './environment.js';
import type { StoredMessage } from './stored-message.js';
import { unique } from './unique.js';
import { eventually } from './waiting.js';

/**
 * A second, plain NATS client next to the buses under test: it reads the streams, drops raw
 * messages in, and deletes the streams of the test. Every bus of a test works on a stream
 * and a subject prefix of that test.
 */
export class Broker {
  readonly stream = unique('test-events');

  readonly subjectPrefix = unique('test');

  private readonly buses: NatsEventBus[] = [];

  private constructor(
    private readonly url: string,
    private readonly connection: NatsConnection,
    private readonly client: JetStreamClient,
    private readonly manager: JetStreamManager,
  ) {}

  static async connect(url: string): Promise<Broker> {
    const connection = await connect({ servers: url });

    return new Broker(url, connection, jetstream(connection), await jetstreamManager(connection));
  }

  /** A bus on the stream of this test, with fast retries. Closed and cleaned by `dispose`. */
  bus(options: Partial<NatsEventBusOptions> = {}): NatsEventBus {
    const bus = new NatsEventBus({
      connection: this.url,
      stream: this.stream,
      subjectPrefix: this.subjectPrefix,
      consumer: unique('consumer'),
      retry: { delayMs: RETRY_DELAY_MS, maxAttempts: MAX_ATTEMPTS },
      reconnect: { initialMs: 20, maxMs: 200 },
      ...options,
    });

    this.buses.push(bus);

    return bus;
  }

  namesOf(binding: ConsumerBinding): ReturnType<typeof bindingNamesOf> {
    return bindingNamesOf(binding, this.subjectPrefix);
  }

  async send(subject: string, body: string): Promise<void> {
    await this.client.publish(subject, body);
  }

  /** Every message the events stream of this test holds, oldest first. */
  published(): Promise<StoredMessage[]> {
    return this.messagesOf(this.stream);
  }

  /** Every message the dead-letter stream of this test holds, oldest first. */
  dead(): Promise<StoredMessage[]> {
    return this.messagesOf(deadStreamOf(this.stream));
  }

  async maxDeliverOf(durable: string): Promise<number | undefined> {
    return (await this.manager.consumers.info(this.stream, durable)).config.max_deliver;
  }

  /** Messages of a durable consumer that are neither acknowledged nor given up on. */
  async waitingFor(durable: string): Promise<number> {
    const info = await this.manager.consumers.info(this.stream, durable);

    return info.num_pending + info.num_ack_pending;
  }

  /**
   * Resolves once everything published to the bus was delivered or given up on: nothing
   * pending or unacknowledged on its durable consumers (a message waiting for its
   * redelivery is unacknowledged) and no handler running, three checks in a row.
   */
  async settled(bus: NatsEventBus): Promise<void> {
    await bus.assertTopology();
    let quietChecks = 0;

    await eventually(async () => {
      quietChecks = (await this.isQuiet(bus)) ? quietChecks + 1 : 0;

      return quietChecks >= 3;
    }, 20_000);
  }

  async dispose(): Promise<void> {
    await Promise.all(this.buses.map((bus) => bus.close()));

    for (const stream of [this.stream, deadStreamOf(this.stream)]) {
      await this.manager.streams.delete(stream).catch(() => undefined);
    }

    await this.connection.close();
  }

  private async isQuiet(bus: NatsEventBus): Promise<boolean> {
    for (const consumer of bus.describeTopology().consumers) {
      if ((await this.waitingFor(consumer.name)) > 0) {
        return false;
      }
    }

    return bus.deliveriesInFlight === 0;
  }

  private async messagesOf(stream: string): Promise<StoredMessage[]> {
    const info = await this.manager.streams.info(stream).catch(() => undefined);
    const messages: StoredMessage[] = [];

    for (let seq = info?.state.first_seq ?? 1; seq <= (info?.state.last_seq ?? 0); seq += 1) {
      const stored = await this.manager.streams.getMessage(stream, { seq }).catch(() => null);

      if (stored !== null) {
        const headers = Object.fromEntries([...stored.header].map(([name, values]) => [name, values.join(',')]));

        messages.push({ subject: stored.subject, body: stored.string(), headers });
      }
    }

    return messages;
  }
}
