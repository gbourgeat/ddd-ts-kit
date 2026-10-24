import { tenantReachOf, tenantScopeOf } from '@ddd-ts-kit/kernel';
import type { PrismaReadModelTenant } from './prisma-read-model-tenant';
import { quoted } from './quoted';

/** A condition on the tenant column of the copy of a rebuild: what follows the `where` of a statement, and its parameters. */
export interface TenantSql {
  readonly clause: string;
  readonly values: readonly unknown[];
}

/** What a read of tenant data may reach, once an elevation over every tenant is read as no condition at all. */
type Reached =
  | { readonly kind: 'tenant'; readonly tenantId: string }
  | { readonly kind: 'elevated'; readonly tenants: readonly string[] };

const NONE: TenantSql = { clause: '', values: [] };
const TENANT_FIELD = 'tenantId';
const TENANT_COLUMN = 'tenant_id';

/**
 * The tenant of the rows of a read model: nothing for a read model of every tenant; for a read
 * model of tenant data, the condition of its reads (the tenant of the work, or the tenants of
 * an elevation), the condition of its writes and what a written row carries (the one tenant of
 * the work), by field for the model and by column for the copy of a rebuild.
 */
export class TenantOfRows {
  private readonly field: string;

  private readonly column: string;

  constructor(
    private readonly tenant: PrismaReadModelTenant | undefined,
    columns: Readonly<Record<string, string>>,
  ) {
    this.field = tenant?.field ?? TENANT_FIELD;
    this.column = columns[this.field] ?? TENANT_COLUMN;
  }

  /** The condition of a read, by field: `{ tenantId: 'acme' }`, the tenants of an elevation, or nothing. */
  reading(): Readonly<Record<string, unknown>> {
    const reach = this.reach();

    if (reach === undefined) {
      return {};
    }

    return { [this.field]: reach.kind === 'tenant' ? reach.tenantId : { in: [...reach.tenants] } };
  }

  /** The one tenant of the work, by field: the condition of a write, and what a written row carries. */
  writing(): Readonly<Record<string, unknown>> {
    return this.tenant === undefined ? {} : { [this.field]: tenantScopeOf(this.tenant.scope).tenantId };
  }

  /** The one tenant of the work, by column: what a row written to the copy of a rebuild carries. */
  written(): Readonly<Record<string, unknown>> {
    return this.tenant === undefined ? {} : { [this.column]: tenantScopeOf(this.tenant.scope).tenantId };
  }

  /** The condition of a read on the copy, its parameters numbered from `next`: one tenant, a list of tenants, or nothing. */
  readingSql(next: number): TenantSql {
    const reach = this.reach();

    if (reach === undefined) {
      return NONE;
    }

    if (reach.kind === 'tenant') {
      return { clause: ` and ${quoted(this.column)} = $${String(next)}`, values: [reach.tenantId] };
    }

    const places = reach.tenants.map((_, index) => `$${String(next + index)}`);

    return reach.tenants.length === 0
      ? { clause: ' and false', values: [] }
      : { clause: ` and ${quoted(this.column)} in (${places.join(', ')})`, values: [...reach.tenants] };
  }

  /** The condition of a write on the copy, its parameter numbered `next`. */
  writingSql(next: number): TenantSql {
    if (this.tenant === undefined) {
      return NONE;
    }

    return {
      clause: ` and ${quoted(this.column)} = $${String(next)}`,
      values: [tenantScopeOf(this.tenant.scope).tenantId],
    };
  }

  /** What the work may read, or `undefined` when every row may be: a read model of every tenant, an elevation over every tenant. */
  private reach(): Reached | undefined {
    if (this.tenant === undefined) {
      return undefined;
    }

    const reach = tenantReachOf(this.tenant.scope);

    if (reach.kind === 'tenant') {
      return reach;
    }

    return reach.tenants === 'all' ? undefined : { kind: 'elevated', tenants: reach.tenants };
  }
}
