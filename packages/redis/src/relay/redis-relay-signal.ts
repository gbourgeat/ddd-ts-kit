import { inspect } from 'node:util';
import type { Redis } from 'ioredis';
import { closeRedis } from '../connection/close-redis';
import { conceal } from '../secrecy/conceal';

export interface RedisRelaySignalOptions {
  /** One channel per outbox. Default `ddd-ts-kit:outbox`. */
  readonly channel?: string;
}

const DESCRIPTION = 'RedisRelaySignal [client concealed]';

/**
 * The `RelaySignal` of `@ddd-ts-kit/events` between processes, over publish/subscribe: the
 * process that appended to the outbox calls `notify`, and a relay built with `wakeOn` in any
 * other process ticks at once instead of at its next interval.
 *
 * Same semantics as the in-memory signal: a hint, never a delivery. Publish/subscribe keeps
 * nothing for a subscriber that is away, so a notification sent while the relay reconnects
 * is lost, and the event goes out at the next poll. Keep the interval of the relay.
 */
export class RedisRelaySignal {
  private readonly client: Redis;

  private readonly channel: string;

  private readonly listeners = new Set<() => void>();

  private subscriber: Redis | undefined;

  constructor(client: Redis, options: RedisRelaySignalOptions = {}) {
    this.client = client;
    this.channel = options.channel ?? 'ddd-ts-kit:outbox';
    conceal(this);
  }

  subscribe(listener: () => void): { unsubscribe(): void } {
    this.listeners.add(listener);
    this.subscriber ??= this.listen();

    return { unsubscribe: () => void this.listeners.delete(listener) };
  }

  /** Never fails: a notification that cannot be sent only delays the publication. */
  async notify(): Promise<void> {
    try {
      await this.client.publish(this.channel, '');
    } catch {
      return;
    }
  }

  /** Closes the connection this signal opened to listen. The client it was given stays open. */
  async close(): Promise<void> {
    this.listeners.clear();
    const subscriber = this.subscriber;

    this.subscriber = undefined;

    if (subscriber !== undefined) {
      await closeRedis(subscriber);
    }
  }

  /** What a serialisation shows: a name, never the client, whose options carry the password. */
  toJSON(): string {
    return DESCRIPTION;
  }

  /** What `console.log` and `util.inspect` show: the same. */
  [inspect.custom](): string {
    return DESCRIPTION;
  }

  /** A connection in subscriber mode accepts no other command, hence one of its own. */
  private listen(): Redis {
    const subscriber = this.client.duplicate();

    // The connection subscribes to the one channel of the signal: every message is one of it.
    subscriber.on('message', () => {
      for (const listener of [...this.listeners]) {
        listener();
      }
    });

    // Without a handler ioredis prints connection errors; it reconnects and subscribes again by itself.
    subscriber.on('error', () => undefined);
    subscriber.subscribe(this.channel).catch(() => undefined);

    return subscriber;
  }
}
