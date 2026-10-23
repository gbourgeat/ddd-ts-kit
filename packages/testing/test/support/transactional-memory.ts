import { AsyncLocalStorage } from 'node:async_hooks';
import { withinUnitOfWork, type IntegrationEvent, type UnitOfWork } from '@ddd-ts-kit/kernel';
import type { UnitOfWorkUnderContract } from '../../src/contracts';

interface Written {
  readonly rows: string[];
  readonly events: IntegrationEvent[];
  refusedAtCommit: boolean;
}

/**
 * A database in memory with real transactions: what a unit of work writes is its own until it
 * commits, and is forgotten when it fails. `cooperating: false` is the adapter that forgot
 * `withinUnitOfWork`: its transactions are as sound, and the contract still fails it.
 */
export class TransactionalMemory implements UnitOfWorkUnderContract {
  readonly unitOfWork: UnitOfWork;

  private readonly committed: Written = { rows: [], events: [], refusedAtCommit: false };

  private readonly current = new AsyncLocalStorage<Written>();

  constructor({ cooperating }: { readonly cooperating: boolean } = { cooperating: true }) {
    this.unitOfWork = {
      run: (work) =>
        cooperating ? withinUnitOfWork(work, (scoped) => this.atomically(scoped)) : this.atomically(work),
    };
  }

  readonly outbox: UnitOfWorkUnderContract['outbox'] = {
    append: async (events) => void this.target().events.push(...events),
    claimBatch: async () => this.committed.events.map((event) => ({ event, status: 'pending', attempts: 1 })),
    stats: async () => ({ pending: this.committed.events.length, failed: 0, dead: 0 }),
  };

  async insert(id: string): Promise<void> {
    if ((await this.ids()).includes(id)) {
      throw new Error(`duplicate key ${id}`);
    }

    this.target().rows.push(id);
  }

  async insertRefusedAtCommit(id: string): Promise<void> {
    await this.insert(id);
    this.target().refusedAtCommit = true;
  }

  async ids(): Promise<string[]> {
    return [...this.committed.rows, ...(this.current.getStore()?.rows ?? [])].sort();
  }

  async committedIds(): Promise<string[]> {
    return [...this.committed.rows].sort();
  }

  private target(): Written {
    return this.current.getStore() ?? this.committed;
  }

  private async atomically<T>(work: () => Promise<T>): Promise<T> {
    if (this.current.getStore() !== undefined) {
      return work();
    }

    const written: Written = { rows: [], events: [], refusedAtCommit: false };
    const result = await this.current.run(written, work);

    if (written.refusedAtCommit) {
      throw new Error('a deferred constraint is violated');
    }

    this.committed.rows.push(...written.rows);
    this.committed.events.push(...written.events);

    return result;
  }
}
