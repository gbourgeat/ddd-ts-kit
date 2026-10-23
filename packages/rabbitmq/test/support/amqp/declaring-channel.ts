import { EventEmitter } from 'node:events';
import type { Connection, Options, Replies } from 'amqplib';
import { AmqpError, IllegalOperation, Unsupported } from './errors';
import { SERVER_PROPERTIES, argumentsOf } from './messages';
import type { BrokerState, Exchange, QueueState } from './model';

/**
 * The half of a channel that declares: exchanges, queues and their bindings. A refusal closes
 * the channel, as the broker does, and the call rejects with the error amqplib would give.
 */
export abstract class DeclaringChannel extends EventEmitter {
  readonly connection: Connection = { serverProperties: SERVER_PROPERTIES };

  protected open = true;

  constructor(protected readonly broker: BrokerState) {
    super();
  }

  async assertQueue(queue = '', options: Options.AssertQueue = {}): Promise<Replies.AssertQueue> {
    this.ensureOpen();
    const declared = this.broker.declareQueue(queue, options.durable ?? true, argumentsOf(options));

    if (declared instanceof AmqpError) {
      throw this.fail(declared);
    }

    return { queue: declared.name, messageCount: declared.messageCount, consumerCount: declared.consumers.length };
  }

  async checkQueue(queue: string): Promise<Replies.AssertQueue> {
    const found = this.existingQueue(queue);

    return { queue, messageCount: found.messageCount, consumerCount: found.consumers.length };
  }

  async deleteQueue(queue: string): Promise<Replies.DeleteQueue> {
    this.ensureOpen();
    const found = this.broker.queue(queue);

    return { messageCount: found === undefined ? 0 : this.broker.deleteQueue(found) };
  }

  async purgeQueue(queue: string): Promise<Replies.PurgeQueue> {
    return { messageCount: this.existingQueue(queue).purge() };
  }

  async bindQueue(queue: string, source: string, pattern: string): Promise<Replies.Empty> {
    const exchange = this.existingExchange(source);

    this.existingQueue(queue);

    if (!exchange.bindings.some((binding) => binding.queue === queue && binding.pattern === pattern)) {
      exchange.bindings.push({ queue, pattern });
    }

    return {};
  }

  async unbindQueue(queue: string, source: string, pattern: string): Promise<Replies.Empty> {
    const exchange = this.existingExchange(source);

    exchange.bindings = exchange.bindings.filter((binding) => binding.queue !== queue || binding.pattern !== pattern);

    return {};
  }

  async assertExchange(
    exchange: string,
    type: string,
    options: Options.AssertExchange = {},
  ): Promise<Replies.AssertExchange> {
    this.ensureOpen();
    const declared = this.broker.declareExchange(exchange, type, options.durable ?? true);

    if (declared instanceof AmqpError) {
      throw this.fail(declared);
    }

    return { exchange };
  }

  async checkExchange(exchange: string): Promise<Replies.Empty> {
    this.existingExchange(exchange);

    return {};
  }

  async deleteExchange(exchange: string): Promise<Replies.Empty> {
    this.ensureOpen();
    this.broker.deleteExchange(exchange);

    return {};
  }

  async bindExchange(): Promise<Replies.Empty> {
    throw new Unsupported('bindExchange');
  }

  async unbindExchange(): Promise<Replies.Empty> {
    throw new Unsupported('unbindExchange');
  }

  /** Closed, by the client, the broker or the loss of the connection. */
  abstract teardown(): void;

  protected existingQueue(name: string): QueueState {
    this.ensureOpen();
    const queue = this.broker.queue(name);

    if (queue === undefined) {
      throw this.fail(new AmqpError(404, `NOT_FOUND - no queue '${name}'`));
    }

    return queue;
  }

  protected existingExchange(name: string): Exchange {
    this.ensureOpen();
    const exchange = this.broker.exchange(name);

    if (exchange === undefined) {
      throw this.fail(new AmqpError(404, `NOT_FOUND - no exchange '${name}'`));
    }

    return exchange;
  }

  /** The broker closes the channel with an error: amqplib emits it, then the close. */
  protected fail(error: AmqpError): AmqpError {
    if (this.open && this.listenerCount('error') > 0) {
      this.emit('error', error);
    }

    this.teardown();

    return error;
  }

  protected ensureOpen(): void {
    if (!this.open) {
      throw new IllegalOperation('Channel closed');
    }
  }
}
