import type { ConfirmChannel, ConsumeMessage, GetMessage, Message, Options, Replies } from 'amqplib';
import { DeclaringChannel } from './declaring-channel';
import { AmqpError, IllegalOperation, Unsupported } from './errors';
import { fieldsOf, propertiesOf } from './messages';
import type {
  BrokerState,
  ChannelOwner,
  Consumer,
  ConsumerChannel,
  QueueState,
  StoredMessage,
  Unacked,
  Wire,
} from './model';

type Confirmation = (error: unknown, ok: Replies.Empty) => void;

/**
 * A confirm channel: publications confirmed once routed (unless the network holds the replies),
 * returned first when mandatory and unroutable, consumers fed up to their prefetch, and on
 * closing every unacknowledged message back at the head of its queue, marked redelivered.
 */
export class MemoryChannel extends DeclaringChannel implements ConfirmChannel, ConsumerChannel {
  private readonly consumers = new Map<string, Consumer>();

  private readonly unacked = new Map<number, Unacked>();

  private readonly unconfirmed = new Set<(error: unknown) => void>();

  private deliveryTag = 0;

  private prefetchCount = 0;

  constructor(
    broker: BrokerState,
    private readonly owner: ChannelOwner,
    private readonly wire: Wire,
  ) {
    super(broker);
  }

  async close(): Promise<void> {
    if (!this.open) {
      throw new IllegalOperation('Channel closed');
    }

    this.teardown();
  }

  publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options: Options.Publish = {},
    callback?: Confirmation,
  ): boolean {
    this.ensureOpen();
    this.wire.sent();
    const confirmed = this.awaitConfirmation(callback);
    const target = this.broker.exchange(exchange);

    // The broker refuses after the fact: the channel closes and the confirmation fails.
    setImmediate(() => {
      if (!this.open) {
        return;
      }

      if (target === undefined) {
        this.fail(new AmqpError(404, `NOT_FOUND - no exchange '${exchange}'`));

        return;
      }

      const properties = propertiesOf(options);
      const message: StoredMessage = { content, properties, exchange, routingKey, redelivered: false };
      const queues = this.broker.route(target, routingKey);

      for (const queue of queues) {
        queue.enqueue(message);
      }

      if (queues.length === 0 && options.mandatory === true) {
        this.emit('return', { content, properties, fields: fieldsOf(message, 0) });
      }

      if (!this.wire.holdingReplies()) {
        confirmed(null);
      }
    });

    return true;
  }

  sendToQueue(queue: string, content: Buffer, options?: Options.Publish, callback?: Confirmation): boolean {
    return this.publish('', queue, content, options, callback);
  }

  async waitForConfirms(): Promise<void> {
    while (this.unconfirmed.size > 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  async consume(
    queue: string,
    onMessage: (message: ConsumeMessage | null) => void,
    options: Options.Consume = {},
  ): Promise<Replies.Consume> {
    const found = this.existingQueue(queue);
    const tag = options.consumerTag ?? this.broker.nextConsumerTag();
    const noAck = options.noAck === true;

    const consumer: Consumer = {
      tag,
      queue: found,
      channel: this,
      limit: this.prefetchCount,
      noAck,
      onMessage,
      unacked: 0,
    };

    this.consumers.set(tag, consumer);
    found.consumers.push(consumer);
    found.dispatch();

    return { consumerTag: tag };
  }

  async cancel(consumerTag: string): Promise<Replies.Empty> {
    this.ensureOpen();
    const consumer = this.consumers.get(consumerTag);

    if (consumer !== undefined) {
      this.removeConsumer(consumer);
    }

    return {};
  }

  async get(queue: string, options: Options.Get = {}): Promise<GetMessage | false> {
    const found = this.existingQueue(queue);
    const message = found.take();

    if (message === undefined) {
      return false;
    }

    const deliveryTag = this.nextDeliveryTag();

    if (options.noAck !== true) {
      this.unacked.set(deliveryTag, { queue: found, message });
    }

    return {
      content: message.content,
      properties: message.properties,
      fields: { ...fieldsOf(message, deliveryTag), messageCount: found.messageCount },
    };
  }

  ack(message: Message): void {
    this.settle(message, (queue) => {
      queue.dispatch();
    });
  }

  ackAll(): void {
    throw new Unsupported('ackAll');
  }

  nack(message: Message, _allUpTo = false, requeue = true): void {
    this.settle(message, (queue, stored) => {
      if (requeue) {
        queue.enqueue({ ...stored, redelivered: true }, true);
      } else {
        this.broker.deadLetter(queue, stored);
        queue.dispatch();
      }
    });
  }

  nackAll(): void {
    throw new Unsupported('nackAll');
  }

  reject(message: Message, requeue = true): void {
    this.nack(message, false, requeue);
  }

  async prefetch(count: number): Promise<Replies.Empty> {
    this.ensureOpen();
    this.prefetchCount = count;

    return {};
  }

  async recover(): Promise<Replies.Empty> {
    throw new Unsupported('recover');
  }

  /** A message of a queue for one of the consumers of this channel. */
  deliver(consumer: Consumer, message: StoredMessage): void {
    const deliveryTag = this.nextDeliveryTag();

    if (!consumer.noAck) {
      consumer.unacked += 1;
      this.unacked.set(deliveryTag, { queue: consumer.queue, message, consumer });
    }

    consumer.onMessage({
      content: message.content,
      properties: message.properties,
      fields: { ...fieldsOf(message, deliveryTag), consumerTag: consumer.tag },
    });
  }

  /** The queue of the consumer is gone: amqplib hands its callback `null`. */
  cancelledByBroker(consumer: Consumer): void {
    this.removeConsumer(consumer);
    consumer.onMessage(null);
  }

  teardown(): void {
    if (!this.open) {
      return;
    }

    this.open = false;
    this.owner.forget(this);

    for (const confirmed of [...this.unconfirmed]) {
      confirmed(new Error('channel closed'));
    }

    for (const consumer of [...this.consumers.values()]) {
      this.removeConsumer(consumer);
    }

    this.requeueUnacked();
    this.emit('close');
  }

  private awaitConfirmation(callback: Confirmation | undefined): (error: unknown) => void {
    const confirmed = (error: unknown): void => {
      if (this.unconfirmed.delete(confirmed)) {
        callback?.(error, {});
      }
    };

    this.unconfirmed.add(confirmed);

    return confirmed;
  }

  private settle(message: Message, settled: (queue: QueueState, stored: StoredMessage) => void): void {
    this.ensureOpen();
    const { deliveryTag } = message.fields;
    const delivery = this.unacked.get(deliveryTag);

    if (delivery === undefined) {
      // The broker closes the channel over an unknown tag; amqplib learns it a moment later.
      setImmediate(() => this.fail(new AmqpError(406, `PRECONDITION_FAILED - unknown delivery tag ${deliveryTag}`)));

      return;
    }

    this.unacked.delete(deliveryTag);

    if (delivery.consumer !== undefined) {
      delivery.consumer.unacked -= 1;
    }

    settled(delivery.queue, delivery.message);
  }

  /** Back to the head of their queue, in their order, marked redelivered. */
  private requeueUnacked(): void {
    const pending = [...this.unacked.values()].reverse();

    this.unacked.clear();

    for (const { queue, message } of pending) {
      queue.enqueue({ ...message, redelivered: true }, true);
    }
  }

  private removeConsumer(consumer: Consumer): void {
    this.consumers.delete(consumer.tag);
    const index = consumer.queue.consumers.indexOf(consumer);

    if (index >= 0) {
      consumer.queue.consumers.splice(index, 1);
    }
  }

  private nextDeliveryTag(): number {
    this.deliveryTag += 1;

    return this.deliveryTag;
  }
}
