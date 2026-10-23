import { EventEmitter } from 'node:events';
import type { Channel, ChannelModel, ConfirmChannel, Connection } from 'amqplib';
import { IllegalOperation, Unsupported } from './errors';
import { MemoryChannel } from './memory-channel';
import { SERVER_PROPERTIES } from './messages';
import type { BrokerState, ChannelOwner, Closable, Severable, Wire } from './model';

/** A connection to the in-memory broker: its channels close with it. */
export class MemoryConnection extends EventEmitter implements ChannelModel, Severable, ChannelOwner {
  readonly connection: Connection = { serverProperties: SERVER_PROPERTIES };

  private readonly channels = new Set<Closable>();

  private open = true;

  constructor(
    private readonly broker: BrokerState,
    private readonly wire: Wire,
  ) {
    super();
  }

  async createChannel(): Promise<Channel> {
    return this.channel();
  }

  async createConfirmChannel(): Promise<ConfirmChannel> {
    return this.channel();
  }

  async updateSecret(): Promise<void> {
    throw new Unsupported('updateSecret');
  }

  async close(): Promise<void> {
    if (!this.open) {
      throw new IllegalOperation('Connection closed');
    }

    this.closeWith(undefined);
  }

  /** The socket is gone: what was unconfirmed fails, what was unacknowledged is requeued. */
  sever(): void {
    if (this.open) {
      const error = Object.assign(new Error('Unexpected close'), { code: 'ECONNRESET' });

      if (this.listenerCount('error') > 0) {
        this.emit('error', error);
      }

      this.closeWith(error);
    }
  }

  forget(channel: Closable): void {
    this.channels.delete(channel);
  }

  private channel(): MemoryChannel {
    if (!this.open) {
      throw new IllegalOperation('Connection closed');
    }

    const channel = new MemoryChannel(this.broker, this, this.wire);

    this.channels.add(channel);

    return channel;
  }

  private closeWith(error: Error | undefined): void {
    this.open = false;

    for (const channel of [...this.channels]) {
      channel.teardown();
    }

    this.emit('close', error);
  }
}
