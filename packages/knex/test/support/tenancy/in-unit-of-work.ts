import type { UnitOfWork } from '@ddd-ts-kit/kernel';
import type { InvoiceRepository } from '../billing-core/domain/repositories/invoice.repository.js';

/**
 * Each call in a transaction of the unit of work, as the bus middleware runs commands and
 * queries: under row-level security a statement outside of one sees nothing, and under database
 * per tenant it is refused.
 */
export function inUnitOfWork(repository: InvoiceRepository, unitOfWork: UnitOfWork): InvoiceRepository {
  return {
    findById: (id) => unitOfWork.run(() => repository.findById(id)),
    save: (invoice) => unitOfWork.run(() => repository.save(invoice)),
  };
}
