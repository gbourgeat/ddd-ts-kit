import type { NatsConnection } from '@nats-io/transport-node';
import { BrokerUnavailableError, EventBusClosedError, failureCode } from './errors.js';
import type { ReconnectOptions } from './options.js';

export interface LinkHooks {
  /** Sets streams and consumers up on a fresh connection. A failure retries. */
  opened(connection: NatsConnection): Promise<void>;
  /** The connection is closed for good: what was set up on it is void. */
  lost(): void;
  failed(code: string): void;
}

export interface LinkSettings {
  readonly open: () => Promise<NatsConnection>;
  readonly reconnect: Required<ReconnectOptions>;
}

/**
 * The one connection of a bus. The client reconnects by itself and resumes its consumers;
 * the link opens the first connection, with a delay that grows with each failed attempt,
 * knows when the server is away, and opens another connection if the client ever gives up.
 */
export class BrokerLink {
  #connection: NatsConnection | undefined;
  #opening: Promise<NatsConnection> | undefined;
  #retry: ReturnType<typeof setTimeout> | undefined;
  #failures = 0;
  #away = false;
  #closed = false;

  constructor(
    private readonly settings: LinkSettings,
    private readonly hooks: LinkHooks,
  ) {}

  /**
   * The live connection. Opens the first one, joins an attempt in progress, and fails at
   * once while the server is away so that a publisher never hangs on it.
   */
  async opened(): Promise<NatsConnection> {
    if (this.#closed) {
      throw new EventBusClosedError();
    }
    if (this.#connection !== undefined) {
      return this.#present(this.#connection);
    }
    if (this.#opening === undefined && this.#retry === undefined) {
      this.#open();
    }
    if (this.#opening === undefined) {
      throw new BrokerUnavailableError('RECONNECTING');
    }
    return this.#opening;
  }

  /** Drops the connection so that everything is rebuilt, after a consumer died on its own. */
  restart(): void {
    const connection = this.#connection;
    if (connection !== undefined) {
      this.#lost(connection);
      void connection.close().catch(ignore);
    }
  }

  /** Sends what is buffered, acknowledgements included, unless the server is away; disconnects. */
  async close(): Promise<void> {
    this.#closed = true;
    clearTimeout(this.#retry);
    this.#retry = undefined;
    const connection = this.#connection ?? (await this.#opening?.catch(ignore));
    this.#connection = undefined;
    if (!this.#away) {
      await connection?.flush().catch(ignore);
    }
    await connection?.close().catch(ignore);
  }

  #present(connection: NatsConnection): NatsConnection {
    if (this.#away) {
      throw new BrokerUnavailableError('RECONNECTING');
    }
    return connection;
  }

  #open(): void {
    const opening = this.#establish();
    this.#opening = opening;
    void opening
      .then(
        () => {
          this.#failures = 0;
        },
        (error: unknown) => {
          this.#failed(error instanceof BrokerUnavailableError ? error.reason : failureCode(error));
        },
      )
      .finally(() => {
        this.#opening = undefined;
      });
  }

  async #establish(): Promise<NatsConnection> {
    const connection = await this.#connect();
    try {
      await this.hooks.opened(connection);
    } catch (error) {
      this.hooks.lost();
      await connection.close().catch(ignore);
      throw new BrokerUnavailableError(failureCode(error));
    }
    if (this.#closed) {
      await connection.close().catch(ignore);
      throw new EventBusClosedError();
    }
    this.#away = false;
    this.#connection = connection;
    void this.#watch(connection);
    return connection;
  }

  async #connect(): Promise<NatsConnection> {
    try {
      return await this.settings.open();
    } catch (error) {
      // Rethrown without its message or cause: a connection error may quote the URL.
      throw new BrokerUnavailableError(failureCode(error));
    }
  }

  async #watch(connection: NatsConnection): Promise<void> {
    void connection.closed().then(() => {
      this.#lost(connection);
    });
    for await (const status of connection.status()) {
      if (this.#connection !== connection) {
        return;
      }
      if (status.type === 'disconnect') {
        this.#away = true;
        this.hooks.failed('CONNECTION_LOST');
      } else if (status.type === 'reconnect') {
        this.#away = false;
      }
    }
  }

  #lost(connection: NatsConnection): void {
    if (this.#connection !== connection) {
      return;
    }
    this.#connection = undefined;
    this.hooks.lost();
    if (!this.#closed) {
      this.#failed('CONNECTION_CLOSED');
    }
  }

  #failed(code: string): void {
    if (this.#closed) {
      return;
    }
    this.hooks.failed(code);
    const { initialMs, factor, maxMs } = this.settings.reconnect;
    const delay = Math.min(maxMs, initialMs * factor ** this.#failures);
    this.#failures += 1;
    this.#retry = setTimeout(() => {
      this.#retry = undefined;
      this.#open();
    }, delay);
  }
}

function ignore(): undefined {
  return undefined;
}
