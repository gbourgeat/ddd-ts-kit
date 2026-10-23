import type { AuditEntry } from '../audit/audit-entry';
import type { AuditFilter } from '../audit/audit-filter';
import type { AuditSortField } from '../audit/audit-sort-field';
import type { PageRequest } from '../pagination/page-request';
import type { Page } from '../pagination/page';

/**
 * The read side, a port of its own: who may read the trail is a decision of the application,
 * and most code that records never reads. The first sort of the request decides the order
 * (default `occurredAt` ascending). An offset page carries `total`, a cursor page `nextCursor`.
 */
export abstract class AuditReader {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.AuditReader' });
  }

  abstract search(filter: AuditFilter, page: PageRequest<AuditSortField>): Promise<Page<AuditEntry>>;
}
