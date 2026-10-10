import type { UnitOfWork } from '@ddd-ts-kit/kernel';

/**
 * The fake of a transactional store: what is written during `run` is staged and only applied
 * when the work succeeds and the commit goes through. Written outside of `run`, it applies at once.
 */
export class StagingUnitOfWork implements UnitOfWork {
  failOnCommit = false;

  private staged: (() => Promise<void>)[] | undefined;

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.staged !== undefined) {
      return work();
    }

    const staged: (() => Promise<void>)[] = [];

    this.staged = staged;

    try {
      const result = await work();

      if (this.failOnCommit) {
        throw new Error('The commit was refused by the database');
      }

      this.staged = undefined;

      for (const apply of staged) {
        await apply();
      }

      return result;
    } finally {
      this.staged = undefined;
    }
  }

  async write(apply: () => Promise<void>): Promise<void> {
    if (this.staged === undefined) {
      await apply();
    } else {
      this.staged.push(apply);
    }
  }
}
