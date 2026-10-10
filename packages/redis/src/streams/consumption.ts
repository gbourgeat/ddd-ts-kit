import type { Redis } from 'ioredis';
import type { IntegrationEventCallback, Subscription } from '@ddd-ts-kit/kernel';
import { GroupReader } from './group-reader.js';
import type { Settings } from './options.js';
import type { ServerLink } from './server-link.js';
import type { ConsumerBinding } from './topology.js';

/** The consuming side: one reader per consumer name, started with its first subscription. */
export class Consumption {
  readonly #readers = new Map<string, GroupReader>();

  constructor(
    private readonly link: ServerLink,
    private readonly settings: Settings,
  ) {}

  /** Entries read by this bus and not settled yet. */
  get inFlight(): number {
    return [...this.#readers.values()].reduce((total, reader) => total + reader.inFlight, 0);
  }

  bindings(): ConsumerBinding[] {
    return [...this.#readers.values()].flatMap((reader) => reader.bindings());
  }

  add({ consumer, type }: ConsumerBinding, handler: IntegrationEventCallback): Subscription {
    const reader = this.#readers.get(consumer) ?? new GroupReader(consumer, this.link, this.settings);
    this.#readers.set(consumer, reader);
    const subscription = reader.subscribe(type, handler);
    return {
      unsubscribe: () => {
        subscription.unsubscribe();
        this.#dismissIfIdle(consumer, reader);
      },
    };
  }

  /** Creates the groups of the subscriptions made so far: what is published next reaches them. */
  async declare(client: Redis): Promise<void> {
    await Promise.all([...this.#readers.values()].map((reader) => reader.declare(client)));
  }

  /** Stops every reader, each after the batch it is handling. */
  async drain(): Promise<void> {
    const readers = [...this.#readers.values()];
    this.#readers.clear();
    await Promise.all(readers.map((reader) => reader.stop()));
  }

  #dismissIfIdle(consumer: string, reader: GroupReader): void {
    if (reader.idle && this.#readers.get(consumer) === reader) {
      this.#readers.delete(consumer);
      void reader.stop();
    }
  }
}
