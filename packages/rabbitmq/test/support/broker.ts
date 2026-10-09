import { randomUUID } from 'node:crypto';
import { connect, type Channel, type ChannelModel, type GetMessage } from 'amqplib';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import {
  RabbitMqEventBus,
  type RabbitMqDelivery,
  type RabbitMqEventBusOptions,
  type RabbitMqFailure,
  type RabbitMqTopology,
} from '../../src/index.js';

/** Set it to run these suites: `amqp://user:password@127.0.0.1:5672`. */
export const AMQP_URL = process.env['DDD_TS_KIT_TEST_AMQP_URL'];

export const RETRY_DELAY_MS = 60;
export const MAX_ATTEMPTS = 3;

export const unique = (prefix: string): string => `${prefix}-${randomUUID().slice(0, 8)}`;

export const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function eventually(
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) {
      throw new Error('The condition was not met in time');
    }
    await pause(10);
  }
}

export const anEvent = (id: string, type = 'ordering.order.placed'): IntegrationEvent => ({
  id,
  type,
  version: 1,
  occurredAt: '2026-03-01T10:00:00.000Z',
  payload: { orderId: `order-${id}` },
});

/**
 * A second, plain AMQP client next to the buses under test: it looks into the queues, drops
 * raw messages in, and removes what the buses declared so that nothing outlives the run.
 */
export class Broker {
  readonly #buses: RabbitMqEventBus[] = [];
  readonly #declared: RabbitMqTopology[] = [];
  /** Messages sent to wait for a retry and not seen again yet, over every bus of the test. */
  #awaitedRetries = 0;

  private constructor(
    private readonly url: string,
    private readonly model: ChannelModel,
    private readonly channel: Channel,
  ) {}

  static async connect(url: string): Promise<Broker> {
    const model = await connect(url);
    return new Broker(url, model, await model.createChannel());
  }

  /** A bus on an exchange of its own, with fast retries. Closed and cleaned by `dispose`. */
  bus(options: Partial<RabbitMqEventBusOptions> = {}): RabbitMqEventBus {
    const bus = new RabbitMqEventBus({
      connection: this.url,
      exchange: unique('test-events'),
      consumer: unique('consumer'),
      retry: { delayMs: RETRY_DELAY_MS, maxAttempts: MAX_ATTEMPTS },
      reconnect: { initialMs: 20, maxMs: 200 },
      ...options,
      onDelivery: (delivery) => {
        this.#awaitedRetries += delivery.outcome === 'retried' ? 1 : 0;
        this.#awaitedRetries -= delivery.attempt > 1 ? 1 : 0;
        options.onDelivery?.(delivery);
      },
    });
    this.#buses.push(bus);
    return bus;
  }

  /** Keeps the topology of a bus for the cleanup, before its subscriptions are removed. */
  remember(bus: RabbitMqEventBus): void {
    this.#declared.push(bus.describeTopology());
  }

  async readyIn(queue: string): Promise<number> {
    return (await this.channel.checkQueue(queue)).messageCount;
  }

  async take(queue: string): Promise<GetMessage | undefined> {
    const message = await this.channel.get(queue, { noAck: true });
    return message === false ? undefined : message;
  }

  /** A queue bound to the exchange for every type, to look at what a bus really sends. */
  async tap(exchange: string): Promise<string> {
    const queue = unique('tap');
    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    await this.channel.assertQueue(queue, { exclusive: true });
    await this.channel.bindQueue(queue, exchange, '#');
    return queue;
  }

  send(exchange: string, routingKey: string, content: Buffer): void {
    this.channel.publish(exchange, routingKey, content, { persistent: true });
  }

  /**
   * Resolves once everything published to the bus was delivered or given up on: nothing ready
   * in its work and retry queues, no handler running, no retry on its way back (a message
   * leaving a retry queue is for an instant in neither), three checks in a row.
   */
  async settled(bus: RabbitMqEventBus): Promise<void> {
    await bus.assertTopology();
    this.remember(bus);
    let quietChecks = 0;
    await eventually(async () => {
      quietChecks = (await this.#isQuiet(bus)) ? quietChecks + 1 : 0;
      return quietChecks >= 3;
    }, 20_000);
  }

  async dispose(): Promise<void> {
    for (const bus of this.#buses) {
      this.remember(bus);
      await bus.close();
    }
    for (const topology of this.#declared) {
      for (const queue of topology.queues) {
        await this.channel.deleteQueue(queue.name);
      }
      for (const exchange of topology.exchanges) {
        await this.channel.deleteExchange(exchange.name);
      }
    }
    await this.model.close();
  }

  async #isQuiet(bus: RabbitMqEventBus): Promise<boolean> {
    const waiting = bus.describeTopology().queues.filter((queue) => queue.role !== 'dead');
    for (const queue of waiting) {
      if ((await this.readyIn(queue.name)) > 0) {
        return false;
      }
    }
    return bus.deliveriesInFlight === 0 && this.#awaitedRetries === 0;
  }
}

export const deliveriesOf = (settled: RabbitMqDelivery[]) => (delivery: RabbitMqDelivery) =>
  void settled.push(delivery);

export const failuresOf = (reported: RabbitMqFailure[]) => (failure: RabbitMqFailure) =>
  void reported.push(failure);
