import type { AuditEntry, AuditReader } from '@ddd-ts-kit/audit';
import type { Page, QueryHandler } from '@ddd-ts-kit/kernel';
import type { SearchAuditEntriesQuery } from '{{alias.platform}}/audit/search-audit-entries.query.js';

export class SearchAuditEntriesHandler implements QueryHandler<SearchAuditEntriesQuery> {
  constructor(private readonly reader: AuditReader) {}

  /**
   * The permission was decided by the guard of the bus. The tenant of the actor then bounds the
   * read itself, in the statement and never in memory: a tenant lists its own chain, and only an
   * actor that belongs to no tenant (an operator of the platform) lists them all.
   */
  async execute(query: SearchAuditEntriesQuery): Promise<Page<AuditEntry>> {
    const { tenantId } = query.actor;

    return this.reader.search({ ...query.filter, ...(tenantId === undefined ? {} : { tenantId }) }, query.page);
  }
}
