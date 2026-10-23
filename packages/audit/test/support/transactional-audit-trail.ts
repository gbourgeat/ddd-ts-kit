import type { AuditRecord, AuditTrail } from '../../src';
import type { StagingUnitOfWork } from './staging-unit-of-work';

/** A trail whose writes share the fate of the unit of work in progress, as a SQL store does. */
export class TransactionalAuditTrail implements AuditTrail {
  constructor(
    private readonly unitOfWork: StagingUnitOfWork,
    private readonly committed: AuditTrail,
  ) {}

  record(record: AuditRecord): Promise<void> {
    return this.unitOfWork.write(() => this.committed.record(record));
  }
}
