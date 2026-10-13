import type { AuditEntry, AuditReader } from '@ddd-ts-kit/audit';
import type { Page, QueryHandler, TenantElevation } from '@ddd-ts-kit/kernel';
import type { Audit } from '@/platform/audit/create-audit';
import type { SearchAuditEntriesQuery } from '@/platform/audit/search-audit-entries.query';

/** Why platform staff reach every network here, as the trail records it: a code, never a sentence. */
const SEARCH_ACROSS_NETWORKS = 'AUDIT_TRAIL_SEARCH';

export class SearchAuditEntriesHandler implements QueryHandler<SearchAuditEntriesQuery> {
  constructor(
    private readonly reader: AuditReader,
    private readonly elevate: Audit['elevate'],
  ) {}

  /**
   * The permission was decided by the guard of the bus: platform staff, who belong to no network.
   * They read through an elevation over the network the filter names, or every network, which
   * the trail records before the read runs; the reader then bounds the statement to it. Never
   * because their actor names no network.
   */
  async execute(query: SearchAuditEntriesQuery): Promise<Page<AuditEntry>> {
    const { tenantId } = query.filter;

    const elevation: TenantElevation = {
      reason: SEARCH_ACROSS_NETWORKS,
      tenants: tenantId === undefined ? 'all' : [tenantId],
    };

    return this.elevate(elevation, () => this.reader.search(query.filter, query.page));
  }
}
