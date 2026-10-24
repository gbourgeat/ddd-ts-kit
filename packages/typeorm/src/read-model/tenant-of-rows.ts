import { tenantReachOf, tenantScopeOf } from '@ddd-ts-kit/kernel';
import type { TypeOrmReadModelTenant } from './type-orm-read-model-tenant';

/** A condition on the tenant column, for the query builder: its clause and the parameters it names. */
export interface TenantCondition {
  readonly clause: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}

/** How a statement names the column of a property: escaped, under an alias or not. */
export type ColumnOf = (property: string) => string;

const TENANT_PROPERTY = 'tenantId';

/**
 * The tenant of the rows of a read model: nothing for a read model of every tenant; for a read
 * model of tenant data, the condition of its reads (the tenant of the work, or the tenants of
 * an elevation), the condition of its writes and what a written row carries (the one tenant of
 * the work). The column is asked for only when there is a tenant: an entity of a read model of
 * every tenant may well have none.
 */
export class TenantOfRows {
  private readonly property: string;

  constructor(private readonly tenant: TypeOrmReadModelTenant | undefined) {
    this.property = tenant?.property ?? TENANT_PROPERTY;
  }

  /** The one tenant of the work, by property: what a written row carries. */
  written(): Readonly<Record<string, unknown>> {
    return this.tenant === undefined ? {} : { [this.property]: tenantScopeOf(this.tenant.scope).tenantId };
  }

  /** The condition of a read, or none when every row may be read. */
  reading(columnOf: ColumnOf): TenantCondition | undefined {
    if (this.tenant === undefined) {
      return undefined;
    }

    const reach = tenantReachOf(this.tenant.scope);
    const column = columnOf(this.property);

    if (reach.kind === 'tenant') {
      return { clause: `${column} = :tenantOfWork`, parameters: { tenantOfWork: reach.tenantId } };
    }

    if (reach.tenants === 'all') {
      return undefined;
    }

    return reach.tenants.length === 0
      ? { clause: '1 = 0', parameters: {} }
      : { clause: `${column} in (:...tenantsOfWork)`, parameters: { tenantsOfWork: [...reach.tenants] } };
  }

  /** The condition of a write: the one tenant of the work, whatever an elevation widens. */
  writing(columnOf: ColumnOf): TenantCondition | undefined {
    if (this.tenant === undefined) {
      return undefined;
    }

    const own = tenantScopeOf(this.tenant.scope).tenantId;

    return { clause: `${columnOf(this.property)} = :ownTenant`, parameters: { ownTenant: own } };
  }
}
