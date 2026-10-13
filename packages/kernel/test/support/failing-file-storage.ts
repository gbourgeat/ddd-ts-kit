import { InMemoryFileStorage } from '../../src/index.js';

/** Where a storage away fails: every deletion, or the moves into a prefix. */
export interface Failures {
  readonly deletes?: boolean;
  readonly movesInto?: string;
}

/** A storage in memory that fails some operations the way a storage out of reach does. */
export class FailingFileStorage extends InMemoryFileStorage {
  constructor(private readonly failures: Failures) {
    super();
  }

  override delete(key: string): Promise<void> {
    return this.failures.deletes === true ? Promise.reject(new Error('storage away')) : super.delete(key);
  }

  override move(from: string, to: string): Promise<void> {
    const { movesInto } = this.failures;

    return movesInto !== undefined && to.startsWith(movesInto)
      ? Promise.reject(new Error('storage away'))
      : super.move(from, to);
  }
}
