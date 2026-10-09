import type { ProcessedEventStore } from '@ddd-ts-kit/kernel';
import type { PrismaContext } from './unit-of-work.js';

/**
 * The one method the store calls on the model of the processed events, typed structurally:
 * the delegate of your generated client (`client.processedEvent`) fits as is on the databases
 * where Prisma offers `skipDuplicates` (PostgreSQL, MySQL, CockroachDB).
 */
export interface PrismaProcessedEventDelegate {
  createMany(args: {
    data: { consumer: string; eventId: string }[];
    skipDuplicates: true;
  }): Promise<{ count: number }>;
}

export interface PrismaProcessedEventStoreOptions<Tx> {
  /** How to reach the model from a client: `(client) => client.processedEvent`. */
  readonly delegate: (client: Tx) => PrismaProcessedEventDelegate;
}

/**
 * Idempotency of consumers. It writes on the client of the context: when the consumer runs
 * inside a unit of work, the mark commits with the effects of the handler and disappears with
 * them if the handler fails, so the redelivery is processed.
 */
export class PrismaProcessedEventStore<Tx> implements ProcessedEventStore {
  readonly #context: PrismaContext<Tx>;
  readonly #delegate: (client: Tx) => PrismaProcessedEventDelegate;

  constructor(context: PrismaContext<Tx>, options: PrismaProcessedEventStoreOptions<Tx>) {
    this.#context = context;
    this.#delegate = options.delegate;
  }

  async markProcessed(consumer: string, eventId: string): Promise<boolean> {
    // INSERT ... ON CONFLICT DO NOTHING: unlike a caught unique violation, it leaves the
    // surrounding PostgreSQL transaction usable.
    const { count } = await this.#delegate(this.#context.client()).createMany({
      data: [{ consumer, eventId }],
      skipDuplicates: true,
    });
    return count === 1;
  }
}
