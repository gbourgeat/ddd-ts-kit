import { connect, type Channel, type ChannelModel, type GetMessage } from 'amqplib';
import { RabbitMqEventBus, type RabbitMqEventBusOptions, type RabbitMqTopology } from '../../src/index.js';
import { MAX_ATTEMPTS, RETRY_DELAY_MS } from './environment.js';
import { unique } from './unique.js';
import { eventually } from './waiting.js';

/**
 * A second, plain AMQP client next to the buses under test: it looks into the queues, drops
 * raw messages in, and removes what the buses declared so that nothing outlives the run.
 */
export class Broker {
  private readonly buses: RabbitMqEventBus[] = [];

  private readonly declared: RabbitMqTopology[] = [];

  /** Messages sent to wait for a retry and not seen again yet, over every bus of the test. */
  private awaitedRetries = 0;

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
        this.awaitedRetries += delivery.outcome === 'retried' ? 1 : 0;
        this.awaitedRetries -= delivery.attempt > 1 ? 1 : 0;
        options.onDelivery?.(delivery);
      },
    });

    this.buses.push(bus);

    return bus;
  }

  /** Keeps the topology of a bus for the cleanup, before its subscriptions are removed. */
  remember(bus: RabbitMqEventBus): void {
    this.declared.push(bus.describeTopology());
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
      quietChecks = (await this.isQuiet(bus)) ? quietChecks + 1 : 0;

      return quietChecks >= 3;
    }, 20_000);
  }

  async dispose(): Promise<void> {
    for (const bus of this.buses) {
      this.remember(bus);
      await bus.close();
    }

    for (const topology of this.declared) {
      for (const queue of topology.queues) {
        await this.channel.deleteQueue(queue.name);
      }

      for (const exchange of topology.exchanges) {
        await this.channel.deleteExchange(exchange.name);
      }
    }

    await this.model.close();
  }

  private async isQuiet(bus: RabbitMqEventBus): Promise<boolean> {
    const waiting = bus.describeTopology().queues.filter((queue) => queue.role !== 'dead');

    for (const queue of waiting) {
      if ((await this.readyIn(queue.name)) > 0) {
        return false;
      }
    }

    return bus.deliveriesInFlight === 0 && this.awaitedRetries === 0;
  }
}
