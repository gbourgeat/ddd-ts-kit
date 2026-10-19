import type { ChannelModel } from 'amqplib';
import { AmqpError } from './errors.js';
import { InMemoryNetwork } from './in-memory-network.js';
import { MemoryConnection } from './memory-connection.js';
import {
  DEFAULT_EXCHANGE,
  RELIABLE,
  type Arguments,
  type BrokerState,
  type Exchange,
  type Opening,
  type QueueState,
  type StoredMessage,
  type Wire,
} from './model.js';
import { Queue } from './queue.js';
import { routes } from './routing.js';
import { sameArguments } from './messages.js';

/**
 * An AMQP 0-9-1 broker in the memory of the test, behind the interfaces of amqplib, so that the
 * suites of the bus run in the unit run too. It keeps what the bus relies on: topic, direct and
 * fanout exchanges, the default exchange, durable queues and their dead-letter arguments,
 * messages expiring after `x-message-ttl`, publisher confirms and returns, prefetch, manual
 * acknowledgement, redelivery of what a closed channel had not acknowledged, a declaration
 * refused with 406 when its arguments differ, 404 for what does not exist. Not kept: the
 * `x-death` headers, exclusive queues, priorities, the expiration of one message.
 */
export class InMemoryAmqp implements BrokerState, Opening {
  private readonly exchanges = new Map<string, Exchange>();

  private readonly queues = new Map<string, Queue>();

  private readonly sequence = { consumer: 0, queue: 0 };

  /** A connection on a network that never fails. */
  readonly connection = (): Promise<ChannelModel> => this.open(RELIABLE);

  /** A network between the bus and this broker that the test can sabotage. */
  network(): InMemoryNetwork {
    return new InMemoryNetwork(this);
  }

  /** @internal Opened by a network: the bus calls `connection` or `InMemoryNetwork.connection`. */
  async open(wire: Wire): Promise<MemoryConnection> {
    return new MemoryConnection(this, wire);
  }

  exchange(name: string): Exchange | undefined {
    return name === '' ? DEFAULT_EXCHANGE : this.exchanges.get(name);
  }

  declareExchange(name: string, type: string, durable: boolean): Exchange | AmqpError {
    if (name === '' || name.startsWith('amq.')) {
      return new AmqpError(403, `ACCESS_REFUSED - exchange name '${name}' contains reserved prefix 'amq.*'`);
    }

    const existing = this.exchanges.get(name);

    if (existing === undefined) {
      const exchange: Exchange = { name, type, durable, bindings: [] };

      this.exchanges.set(name, exchange);

      return exchange;
    }

    if (existing.type !== type || existing.durable !== durable) {
      return new AmqpError(406, `PRECONDITION_FAILED - inequivalent arg 'type' for exchange '${name}'`);
    }

    return existing;
  }

  deleteExchange(name: string): void {
    this.exchanges.delete(name);
  }

  queue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  declareQueue(name: string, durable: boolean, args: Arguments): Queue | AmqpError {
    const queueName = name === '' ? `amq.gen-${String((this.sequence.queue += 1))}` : name;
    const existing = this.queues.get(queueName);

    if (existing === undefined) {
      const queue = new Queue(this, queueName, durable, args);

      this.queues.set(queueName, queue);

      return queue;
    }

    if (existing.durable !== durable || !sameArguments(existing.args, args)) {
      return new AmqpError(406, `PRECONDITION_FAILED - inequivalent arg for queue '${queueName}'`);
    }

    return existing;
  }

  /** Cancels its consumers, as the broker does: each one is handed `null`. */
  deleteQueue(queue: QueueState): number {
    this.queues.delete(queue.name);

    for (const exchange of this.exchanges.values()) {
      exchange.bindings = exchange.bindings.filter((binding) => binding.queue !== queue.name);
    }

    for (const consumer of [...queue.consumers]) {
      consumer.channel.cancelledByBroker(consumer);
    }

    return queue.purge();
  }

  nextConsumerTag(): string {
    this.sequence.consumer += 1;

    return `amq.ctag-${String(this.sequence.consumer)}`;
  }

  /** The queues an exchange routes a message to; the default exchange routes by queue name. */
  route(exchange: Exchange, routingKey: string): Queue[] {
    if (exchange === DEFAULT_EXCHANGE) {
      const queue = this.queues.get(routingKey);

      return queue === undefined ? [] : [queue];
    }

    const names = new Set(
      exchange.bindings
        .filter((binding) => routes(exchange.type, binding.pattern, routingKey))
        .map((binding) => binding.queue),
    );

    return [...names].flatMap((name) => this.queues.get(name) ?? []);
  }

  /** Where a queue sends what expired or was rejected without requeueing, if it says so. */
  deadLetter(queue: QueueState, message: StoredMessage): void {
    const exchangeName = queue.args['x-dead-letter-exchange'];

    if (typeof exchangeName !== 'string') {
      return;
    }

    const exchange = this.exchange(exchangeName);
    const routingKey = queue.args['x-dead-letter-routing-key'];
    const key = typeof routingKey === 'string' ? routingKey : message.routingKey;

    for (const target of exchange === undefined ? [] : this.route(exchange, key)) {
      target.enqueue({ ...message, exchange: exchangeName, routingKey: key, redelivered: false });
    }
  }
}
