import {
  pageOf,
  tenantReachOf,
  type AuditEntry,
  type AuditFilter,
  type AuditReader,
  type AuditSortField,
  type ExecutionScope,
  type Page,
  type PageRequest,
} from '@ddd-ts-kit/kernel';

/**
 * The trail as a tenant may read it: every search is confined to the tenant of the work in
 * progress, whatever the filter says, and a filter that names another tenant or another chain
 * finds nothing. Platform staff read across tenants under an elevation (`acrossTenants`): over
 * `all`, the filter as it is; over a list, a search names one tenant of the list. Work that names
 * no tenant and no elevation is refused (`NoCurrentTenantError`).
 */
export class TenantAuditReader implements AuditReader {
  constructor(
    private readonly reader: AuditReader,
    private readonly scope: ExecutionScope,
  ) {}

  async search(filter: AuditFilter, page: PageRequest<AuditSortField>): Promise<Page<AuditEntry>> {
    const confined = this.confined(filter);

    return confined === undefined ? pageOf<AuditEntry>([], { total: 0 }) : this.reader.search(confined, page);
  }

  /** The filter within the reach of the work, or `undefined` when it can only find another tenant's entries. */
  private confined(filter: AuditFilter): AuditFilter | undefined {
    const reach = tenantReachOf(this.scope);

    if (reach.kind === 'elevated') {
      return reach.tenants === 'all' || reachesListed(filter, reach.tenants) ? filter : undefined;
    }

    const { tenantId } = reach;

    const elsewhere =
      (filter.tenantId !== undefined && filter.tenantId !== tenantId) ||
      (filter.chain !== undefined && filter.chain !== `tenant:${tenantId}`);

    return elsewhere ? undefined : { ...filter, tenantId };
  }
}

function reachesListed(filter: AuditFilter, tenants: readonly string[]): boolean {
  return filter.tenantId !== undefined && tenants.includes(filter.tenantId);
}
