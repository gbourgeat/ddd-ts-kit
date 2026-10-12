import knex, { type Knex } from 'knex';
import type { TenantDatabasesOptions } from './tenant-databases-options.js';
import { tenantSchemaOf } from './tenant-schema-of.js';

const DEFAULT_MAX_TENANTS = 20;

/**
 * One database per tenant: a knex instance (its own bounded pool) per tenant, opened on first
 * use and kept for the most recently used `maxTenants`. Closing a pool waits for the
 * connections it lent. `createTenantRoutedUnitOfWork` routes every statement to the database of
 * the tenant of the work.
 */
export class TenantDatabases {
  private readonly open = new Map<string, Knex>();

  private readonly closing = new Set<Promise<void>>();

  constructor(private readonly options: TenantDatabasesOptions) {}

  knexOf(tenantId: string): Knex {
    tenantSchemaOf('tenant', tenantId);

    const known = this.open.get(tenantId);

    if (known !== undefined) {
      this.open.delete(tenantId);
      this.open.set(tenantId, known);

      return known;
    }

    return this.opened(tenantId);
  }

  /** The tenants whose pool is open, least recently used first. */
  tenants(): readonly string[] {
    return [...this.open.keys()];
  }

  async close(): Promise<void> {
    const all = [...this.open.values()];

    this.open.clear();
    await Promise.all([...all.map((instance) => instance.destroy()), ...this.closing]);
  }

  private opened(tenantId: string): Knex {
    const instance = (this.options.open ?? knex)(this.options.connectionOf(tenantId));

    this.open.set(tenantId, instance);
    this.evictBeyondLimit();

    return instance;
  }

  private evictBeyondLimit(): void {
    const limit = this.options.maxTenants ?? DEFAULT_MAX_TENANTS;

    for (const [tenantId, instance] of this.open) {
      if (this.open.size <= limit) {
        return;
      }

      this.open.delete(tenantId);

      const closed = instance.destroy().finally(() => this.closing.delete(closed));

      this.closing.add(closed);
    }
  }
}
