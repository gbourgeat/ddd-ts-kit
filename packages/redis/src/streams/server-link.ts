import { Redis } from 'ioredis';
import { FAIL_FAST, closeRedis, type RedisSource } from '../connection.js';
import { BrokerUnavailableError, EventBusClosedError, failureCode } from './errors.js';
import { reconnectDelay, type ReconnectOptions } from './options.js';

export interface LinkSettings {
  readonly connection: RedisSource;
  readonly reconnect: Required<ReconnectOptions>;
  readonly blockMs: number;
}

/**
 * The connection the bus publishes and acknowledges on, and the source of the connections
 * its readers block on. ioredis reconnects by itself; the link reports what happens to the
 * connection as codes and answers at once, instead of queueing, while the server is away.
 */
export class ServerLink {
  readonly #client: Redis;
  readonly #owned: boolean;
  readonly #blockMs: number;
  readonly #failed: (code: string) => void;
  #reason = 'NOT_CONNECTED';
  #wasReady: boolean;
  #closed = false;

  constructor(settings: LinkSettings, failed: (code: string) => void) {
    const { connection } = settings;
    this.#owned = !(connection instanceof Redis);
    this.#client = connection instanceof Redis ? connection : opened(connection, settings.reconnect);
    this.#blockMs = settings.blockMs;
    this.#failed = failed;
    this.#wasReady = this.#client.status === 'ready';
    this.#client.on('ready', this.#onReady).on('error', this.#onError).on('close', this.#onClose);
  }

  /** The connection for commands that answer at once. A command sent while the server is away fails by the rules of the client. */
  get client(): Redis {
    return this.#client;
  }

  /**
   * The live connection. Waits for the first connection in progress and fails at once between
   * two reconnection attempts, so that a publisher never hangs on a server that is down.
   */
  async ready(): Promise<Redis> {
    this.#refuseOnceClosed();
    const client = this.#client;
    if (client.status === 'ready') return client;
    if (client.status === 'wait') void client.connect().catch(ignore);
    if (!CONNECTING.has(client.status)) throw new BrokerUnavailableError(this.#reason);
    await connected(client);
    this.#refuseOnceClosed();
    if (!this.#wasReady) throw new BrokerUnavailableError(this.#reason);
    return client;
  }

  /**
   * A connection of its own for a blocking reader. Its command timeout leaves the server the
   * time to answer a read that found nothing; beyond it the connection is deemed dead.
   */
  reader(): Redis {
    const patience = this.#client.options.commandTimeout ?? FAIL_FAST.commandTimeout ?? 0;
    const reader = this.#client.duplicate({ commandTimeout: this.#blockMs + patience });
    // Without a handler ioredis prints connection errors; the reader reports its own failures.
    reader.on('error', ignore);
    return reader;
  }

  async close(): Promise<void> {
    this.#closed = true;
    this.#client.off('ready', this.#onReady).off('error', this.#onError).off('close', this.#onClose);
    if (this.#owned) {
      this.#client.on('error', ignore);
      await closeRedis(this.#client);
    }
  }

  #refuseOnceClosed(): void {
    if (this.#closed) throw new EventBusClosedError();
  }

  readonly #onReady = (): void => {
    this.#wasReady = true;
  };

  readonly #onError = (error: unknown): void => {
    this.#lost(failureCode(error));
  };

  readonly #onClose = (): void => {
    if (this.#wasReady) this.#lost('CONNECTION_LOST');
  };

  #lost(code: string): void {
    this.#wasReady = false;
    this.#reason = code;
    if (!this.#closed) this.#failed(code);
  }
}

const CONNECTING: ReadonlySet<string> = new Set(['wait', 'connecting', 'connect']);

function opened(source: Exclude<RedisSource, Redis>, reconnect: Required<ReconnectOptions>): Redis {
  const retryStrategy = (attempt: number): number => reconnectDelay(reconnect, attempt);
  const defaults = { ...FAIL_FAST, retryStrategy };
  return typeof source === 'string' ? new Redis(source, defaults) : new Redis({ ...defaults, ...source });
}

/** Resolves when the connection in progress succeeded or failed. */
function connected(client: Redis): Promise<void> {
  return new Promise((resolve) => {
    const settle = (): void => {
      client.off('ready', settle).off('close', settle).off('end', settle);
      resolve();
    };
    client.once('ready', settle).once('close', settle).once('end', settle);
  });
}

function ignore(): undefined {
  return undefined;
}
