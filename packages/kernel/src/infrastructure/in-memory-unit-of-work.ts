import type { UnitOfWork } from '../application/ports.js';

/** No transaction to open: runs the work as is. Real adapters wrap a DB transaction. */
export class InMemoryUnitOfWork implements UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}
