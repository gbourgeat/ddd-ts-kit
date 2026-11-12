import { AsyncLocalStorage } from 'node:async_hooks';
import { advisoryLockKey, type ExecutionScope } from '@ddd-ts-kit/kernel';
import type { AdvisoryLockUnderContract } from '../../src/contracts';

/** Advisory locks as PostgreSQL holds them, in memory: by transaction, until it ends. */
export class InMemoryAdvisoryLocks implements AdvisoryLockUnderContract {
  private readonly transaction = new AsyncLocalStorage<object>();

  private readonly holders = new Map<string, object>();

  private waiting: (() => void)[] = [];

  async run<T>(work: () => Promise<T>): Promise<T> {
    const transaction = {};

    try {
      return await this.transaction.run(transaction, work);
    } finally {
      this.release(transaction);
    }
  }

  async lock(key: string, tenant?: ExecutionScope): Promise<void> {
    while (!(await this.tryLock(key, tenant))) {
      await new Promise<void>((resolve) => {
        this.waiting.push(resolve);
      });
    }
  }

  tryLock(key: string, tenant?: ExecutionScope): Promise<boolean> {
    const transaction = this.transaction.getStore();
    const probe = { inTransaction: () => transaction !== undefined };

    return Promise.resolve().then(() => {
      const text = advisoryLockKey(probe, key, tenant === undefined ? {} : { tenant });
      const holder = this.holders.get(text) ?? transaction ?? {};

      this.holders.set(text, holder);

      return holder === transaction;
    });
  }

  held(): Promise<number> {
    const transaction = this.transaction.getStore();

    return Promise.resolve([...this.holders.values()].filter((holder) => holder === transaction).length);
  }

  private release(transaction: object): void {
    for (const [text, holder] of this.holders) {
      if (holder === transaction) {
        this.holders.delete(text);
      }
    }

    const woken = this.waiting;

    this.waiting = [];

    for (const wake of woken) {
      wake();
    }
  }
}
