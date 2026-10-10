import type { Persistence } from '@/platform/database/persistence.js';

/**
 * An infrastructure fault a spec switches on and off: while it lasts, the storage refuses to
 * open a unit of work, as a database that no longer answers does. No business code knows.
 */
export class StorageOutage {
  private lasting = false;

  begin(): void {
    this.lasting = true;
  }

  end(): void {
    this.lasting = false;
  }

  /** The storage of the application, with the outage in front of its unit of work. */
  around(persistence: Persistence): Persistence {
    const run = <T>(work: () => Promise<T>): Promise<T> =>
      this.lasting ? Promise.reject(new Error('The storage does not answer.')) : persistence.unitOfWork.run(work);

    return { ...persistence, unitOfWork: { run } };
  }
}
