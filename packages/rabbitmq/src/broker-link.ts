import type { ChannelModel } from 'amqplib';
import { BrokerUnavailableError, EventBusClosedError, failureCode } from './errors.js';
import type { ReconnectOptions } from './options.js';

export interface LinkHooks {
  /** Sets channels, topology and consumers up on a fresh connection. A failure retries. */
  opened(model: ChannelModel): Promise<void>;
  /** The connection is gone: what was set up on it is void. */
  lost(): void;
  failed(code: string): void;
}

export interface LinkSettings {
  readonly open: () => Promise<ChannelModel>;
  readonly reconnect: Required<ReconnectOptions>;
}

/**
 * The one connection of a bus, kept alive: when it drops, it is opened again after a delay
 * that grows with each failed attempt, and the hooks rebuild what lived on it.
 */
export class BrokerLink {
  #model: ChannelModel | undefined;
  #opening: Promise<ChannelModel> | undefined;
  #retry: ReturnType<typeof setTimeout> | undefined;
  #failures = 0;
  #closed = false;

  constructor(
    private readonly settings: LinkSettings,
    private readonly hooks: LinkHooks,
  ) {}

  /**
   * The live connection. Opens the first one, joins an attempt in progress, and fails at
   * once between two attempts so that a publisher never hangs on a broker that is down.
   */
  async opened(): Promise<ChannelModel> {
    if (this.#closed) {
      throw new EventBusClosedError();
    }
    if (this.#model !== undefined) {
      return this.#model;
    }
    if (this.#opening === undefined && this.#retry === undefined) {
      this.#open();
    }
    if (this.#opening === undefined) {
      throw new BrokerUnavailableError('RECONNECTING');
    }
    return this.#opening;
  }

  /** Drops the connection so that everything is rebuilt, after a channel died on its own. */
  restart(): void {
    const model = this.#model;
    if (model !== undefined) {
      this.#lost(model);
      void model.close().catch(ignore);
    }
  }

  async close(): Promise<void> {
    this.#closed = true;
    clearTimeout(this.#retry);
    this.#retry = undefined;
    const model = this.#model ?? (await this.#opening?.catch(ignore));
    this.#model = undefined;
    await model?.close().catch(ignore);
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

  async #establish(): Promise<ChannelModel> {
    const model = await this.#connect();
    model.on('error', ignore);
    model.on('close', () => {
      this.#lost(model);
    });
    try {
      await this.hooks.opened(model);
    } catch (error) {
      this.hooks.lost();
      await model.close().catch(ignore);
      throw new BrokerUnavailableError(failureCode(error));
    }
    if (this.#closed) {
      await model.close().catch(ignore);
      throw new EventBusClosedError();
    }
    this.#model = model;
    return model;
  }

  async #connect(): Promise<ChannelModel> {
    try {
      return await this.settings.open();
    } catch (error) {
      // Rethrown without its message or cause: a connection error may quote the URL.
      throw new BrokerUnavailableError(failureCode(error));
    }
  }

  #lost(model: ChannelModel): void {
    if (this.#model !== model) {
      return;
    }
    this.#model = undefined;
    this.hooks.lost();
    if (!this.#closed) {
      this.#failed('CONNECTION_LOST');
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
