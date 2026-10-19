import type { InMemoryAmqp } from './in-memory-amqp.js';
import type { Arguments, Consumer, StoredMessage } from './model.js';

/** A queue: its ready messages, each with its expiry, handed to its consumers in turn. */
export class Queue {
  readonly consumers: Consumer[] = [];

  private readonly ready: { readonly message: StoredMessage; expiry: ReturnType<typeof setTimeout> | undefined }[] = [];

  private dispatching = false;

  private turn = 0;

  constructor(
    private readonly broker: InMemoryAmqp,
    readonly name: string,
    readonly durable: boolean,
    readonly args: Arguments,
  ) {}

  get messageCount(): number {
    return this.ready.length;
  }

  enqueue(message: StoredMessage, atHead = false): void {
    const entry = { message, expiry: this.expiryOf(message) };

    if (atHead) {
      this.ready.unshift(entry);
    } else {
      this.ready.push(entry);
    }

    this.dispatch();
  }

  take(): StoredMessage | undefined {
    const entry = this.ready.shift();

    clearTimeout(entry?.expiry);

    return entry?.message;
  }

  purge(): number {
    const count = this.ready.length;

    for (const entry of this.ready.splice(0)) {
      clearTimeout(entry.expiry);
    }

    return count;
  }

  /** Hands the ready messages to the consumers with room left, in turn, on the next tick. */
  dispatch(): void {
    if (this.dispatching) {
      return;
    }

    this.dispatching = true;

    setImmediate(() => {
      this.dispatching = false;
      let consumer = this.nextConsumer();

      while (this.ready.length > 0 && consumer !== undefined) {
        const message = this.take();

        if (message !== undefined) {
          consumer.channel.deliver(consumer, message);
        }

        consumer = this.nextConsumer();
      }
    });
  }

  private nextConsumer(): Consumer | undefined {
    for (let offset = 0; offset < this.consumers.length; offset += 1) {
      const index = (this.turn + offset) % this.consumers.length;
      const consumer = this.consumers[index];

      if (consumer !== undefined && (consumer.limit === 0 || consumer.unacked < consumer.limit)) {
        this.turn = index + 1;

        return consumer;
      }
    }

    return undefined;
  }

  private expiryOf(message: StoredMessage): ReturnType<typeof setTimeout> | undefined {
    const ttl = this.args['x-message-ttl'];

    if (typeof ttl !== 'number') {
      return undefined;
    }

    const expiry = setTimeout(() => {
      const index = this.ready.findIndex((entry) => entry.message === message);

      if (index >= 0) {
        this.ready.splice(index, 1);
        this.broker.deadLetter(this, message);
      }
    }, ttl);

    expiry.unref();

    return expiry;
  }
}
