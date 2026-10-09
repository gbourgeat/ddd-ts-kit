import type { ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';

interface MemoryState {
  readonly processed: Set<string>;
  readonly invoicedOrders: string[];
}

/**
 * A database in miniature: what is written inside `run` is visible to the work in progress
 * and reaches the committed state only if the work succeeds.
 */
export class TransactionalMemory implements UnitOfWork {
  #committed: MemoryState = { processed: new Set(), invoicedOrders: [] };
  #working: MemoryState | undefined;
  commits = 0;

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.#working !== undefined) {
      return work();
    }
    this.#working = {
      processed: new Set(this.#committed.processed),
      invoicedOrders: [...this.#committed.invoicedOrders],
    };
    try {
      const result = await work();
      this.#committed = this.#working;
      this.commits += 1;
      return result;
    } finally {
      this.#working = undefined;
    }
  }

  inTransaction(): boolean {
    return this.#working !== undefined;
  }

  state(): MemoryState {
    return this.#working ?? this.#committed;
  }

  committed(): MemoryState {
    return this.#committed;
  }
}

/** Writes on the current transaction, as a SQL adapter does: no way to take a mark back. */
export class TransactionalProcessedEventStore implements ProcessedEventStore {
  constructor(private readonly memory: TransactionalMemory) {}

  async markProcessed(consumer: string, eventId: string): Promise<boolean> {
    const key = JSON.stringify([consumer, eventId]);
    const { processed } = this.memory.state();
    if (processed.has(key)) {
      return false;
    }
    processed.add(key);
    return true;
  }
}
