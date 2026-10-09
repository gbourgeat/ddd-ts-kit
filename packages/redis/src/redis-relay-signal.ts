import type { Redis } from 'ioredis';
import type { BusMiddleware } from '@ddd-ts-kit/kernel';
import { closeRedis } from './connection.js';

export interface RedisRelaySignalOptions {
  /** One channel per outbox. Default `ddd-ts-kit:outbox`. */
  readonly channel?: string;
}

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
  readonly #client: Redis;
  readonly #channel: string;
  readonly #listeners = new Set<() => void>();
  #subscriber: Redis | undefined;

  constructor(client: Redis, options: RedisRelaySignalOptions = {}) {
    this.#client = client;
    this.#channel = options.channel ?? 'ddd-ts-kit:outbox';
  }

  subscribe(listener: () => void): { unsubscribe(): void } {
    this.#listeners.add(listener);
    this.#subscriber ??= this.#listen();
    return { unsubscribe: () => void this.#listeners.delete(listener) };
  }

  /** Never fails: a notification that cannot be sent only delays the publication. */
  async notify(): Promise<void> {
    try {
      await this.#client.publish(this.#channel, '');
    } catch {
      return;
    }
  }

  /** Closes the connection this signal opened to listen. The client it was given stays open. */
  async close(): Promise<void> {
    this.#listeners.clear();
    const subscriber = this.#subscriber;
    this.#subscriber = undefined;
    if (subscriber !== undefined) await closeRedis(subscriber);
  }

  /** A connection in subscriber mode accepts no other command, hence one of its own. */
  #listen(): Redis {
    const subscriber = this.#client.duplicate();
    subscriber.on('message', (channel) => {
      if (channel !== this.#channel) return;
      for (const listener of [...this.#listeners]) listener();
    });
    // Without a handler ioredis prints connection errors; it reconnects and subscribes again by itself.
    subscriber.on('error', () => undefined);
    subscriber.subscribe(this.#channel).catch(() => undefined);
    return subscriber;
  }
}

/**
 * Notifies after each command that succeeded. Install it before `unitOfWorkMiddleware`, so
 * that the notification leaves once the transaction that appended to the outbox has
 * committed. A command that published nothing wakes the relay for nothing, which costs one
 * empty claim.
 */
export function relayWakeUpMiddleware(signal: { notify(): Promise<void> }): BusMiddleware {
  return async (_message, next, info) => {
    const result = await next();
    if (info.kind === 'command') void signal.notify().catch(() => undefined);
    return result;
  };
}
