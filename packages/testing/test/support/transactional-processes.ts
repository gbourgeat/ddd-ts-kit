import { AsyncLocalStorage } from 'node:async_hooks';
import { ConcurrencyError, type StoredProcess } from '@ddd-ts-kit/kernel';
import type { ProcessStoreUnderContract } from '../../src/contracts.js';

/**
 * A process store in memory with real transactions: what a unit of work saves is its own until it
 * commits, and is forgotten when the work fails.
 */
export class TransactionalProcesses implements ProcessStoreUnderContract {
  readonly unitOfWork = {
    run: <T>(work: () => Promise<T>): Promise<T> => this.atomically(work),
  };

  private readonly committed = new Map<string, StoredProcess>();

  private readonly current = new AsyncLocalStorage<Map<string, StoredProcess>>();

  async load(name: string, id: string): Promise<StoredProcess | undefined> {
    const stored = this.visible(keyOf(name, id));

    return stored === undefined ? undefined : structuredClone(stored);
  }

  async save(process: StoredProcess): Promise<void> {
    const key = keyOf(process.name, process.id);
    const current = this.visible(key)?.version ?? 0;

    if (process.version !== current + 1) {
      throw new ConcurrencyError(key);
    }

    (this.current.getStore() ?? this.committed).set(key, structuredClone(process));
  }

  private visible(key: string): StoredProcess | undefined {
    return this.current.getStore()?.get(key) ?? this.committed.get(key);
  }

  private async atomically<T>(work: () => Promise<T>): Promise<T> {
    const written = new Map<string, StoredProcess>();
    const result = await this.current.run(written, work);

    for (const [key, process] of written) {
      this.committed.set(key, process);
    }

    return result;
  }
}

function keyOf(name: string, id: string): string {
  return `${name}:${id}`;
}
