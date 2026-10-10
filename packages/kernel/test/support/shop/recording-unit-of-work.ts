import type { UnitOfWork } from '../../../src/index.js';

/**
 * A unit of work written without `withinUnitOfWork`, as a project may have one: it notes its
 * transaction in the journal and nothing else. `failNextCommit` makes the next commit fail, as a
 * deferred constraint or a lost connection would.
 */
export class RecordingUnitOfWork implements UnitOfWork {
  failNextCommit: Error | undefined;

  constructor(private readonly journal: string[]) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    this.journal.push('begin');

    try {
      const result = await work();

      this.commit();

      return result;
    } catch (error) {
      this.journal.push('rollback');

      throw error;
    }
  }

  private commit(): void {
    const failure = this.failNextCommit;

    this.failNextCommit = undefined;

    if (failure !== undefined) {
      throw failure;
    }

    this.journal.push('commit');
  }
}
