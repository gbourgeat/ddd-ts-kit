import type { UnitOfWork } from '../../application/ports/unit-of-work';
import { withinUnitOfWork } from '../domain-events/within-unit-of-work';

/**
 * No transaction to open: runs the work as is, and nothing is undone when it fails. The domain
 * events are dispatched at its end all the same. Real adapters wrap a DB transaction.
 */
export class InMemoryUnitOfWork implements UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T> {
    return withinUnitOfWork(work, (scoped) => scoped());
  }
}
