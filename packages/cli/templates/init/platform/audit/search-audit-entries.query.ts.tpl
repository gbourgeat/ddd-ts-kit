import type { AuditEntry, AuditFilter, AuditSortField } from '@ddd-ts-kit/audit';
import { AuthorizedQuery, type Actor, type Page, type PageRequest } from '@ddd-ts-kit/kernel';

/** What a reader of the trail may narrow the search by. The tenant is not among them: it is the one of the actor. */
export type AuditEntriesFilter = Pick<AuditFilter, 'actorId' | 'action' | 'outcome' | 'correlationId'>;

/** A page of the audit trail, for whoever holds `audit:trail.read`. */
export class SearchAuditEntriesQuery extends AuthorizedQuery<Page<AuditEntry>> {
  constructor(
    actor: Actor,
    readonly page: PageRequest<AuditSortField>,
    readonly filter: AuditEntriesFilter = {},
  ) {
    super(actor);
  }
}
