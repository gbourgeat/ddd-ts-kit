import type { AuditRecord } from '../audit/audit-record';

/**
 * The write side of the audit trail: append only. There is no update and no delete, here or
 * in any adapter: an entry that turns out to be wrong is corrected by another entry. Fed by
 * infrastructure and cross-cutting code, never by a use case or an aggregate.
 */
export abstract class AuditTrail {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.AuditTrail' });
  }

  abstract record(record: AuditRecord): Promise<void>;
}
