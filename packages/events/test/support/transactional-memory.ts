import type { UnitOfWork } from '@ddd-ts-kit/kernel';

interface MemoryState {
  readonly processed: Set<string>;
  readonly invoicedOrders: string[];
}

/**
 * A database in miniature: what is written inside `run` is visible to the work in progress
 * and reaches the committed state only if the work succeeds.
 */
export class TransactionalMemory implements UnitOfWork {
  commits = 0;

  private committedState: MemoryState = { processed: new Set(), invoicedOrders: [] };

  private working: MemoryState | undefined;

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.working !== undefined) {
      return work();
    }

    this.working = {
      processed: new Set(this.committedState.processed),
      invoicedOrders: [...this.committedState.invoicedOrders],
    };

    try {
      const result = await work();

      this.committedState = this.working;
      this.commits += 1;

      return result;
    } finally {
      this.working = undefined;
    }
  }

  inTransaction(): boolean {
    return this.working !== undefined;
  }

  state(): MemoryState {
    return this.working ?? this.committedState;
  }

  committed(): MemoryState {
    return this.committedState;
  }
}
