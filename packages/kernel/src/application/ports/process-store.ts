import type { StoredProcess } from '../process/stored-process';

/** Where the instances of the process managers keep their state between two steps. */
export abstract class ProcessStore {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.ProcessStore' });
  }

  abstract load(name: string, id: string): Promise<StoredProcess | undefined>;

  /**
   * Saves the instance at `version`, in the transaction of the caller when the store is
   * transactional. Throws `ConcurrencyError` when the stored version is not `version - 1`
   * (none stored for a version of 1): another step saved it in between.
   */
  abstract save(process: StoredProcess): Promise<void>;
}
