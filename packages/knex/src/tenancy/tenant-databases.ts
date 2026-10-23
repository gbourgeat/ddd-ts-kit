import knex, { type Knex } from 'knex';
import { assertTenantId } from '@ddd-ts-kit/kernel';
import type { TenantDatabasesOptions } from './tenant-databases-options';

const DEFAULT_MAX_TENANTS = 20;

/** The knex instance of one tenant, and how many units of work hold it. */
interface TenantPool {
  readonly knex: Knex;
  leases: number;
}

/**
 * One database per tenant: a knex instance (its own bounded pool) per tenant, opened on first
 * use. At most `maxTenants` instances exist at once, those being closed included, so the
 * connections stay within `maxTenants * pool.max`. A tenant's work holds its instance by a lease
 * (`lease`): an instance is closed only when no work holds it, the least recently used first,
 * and work for another tenant waits for a place rather than opening beyond the bound.
 * `createTenantRoutedUnitOfWork` takes a lease for each transaction.
 */
export class TenantDatabases {
  private readonly pools = new Map<string, TenantPool>();

  private readonly draining = new Set<Promise<void>>();

  private waiting: (() => void)[] = [];

  constructor(private readonly options: TenantDatabasesOptions) {}

  /** Runs `work` with the database of the tenant, held open until `work` settles. */
  async lease<T>(tenantId: string, work: (database: Knex) => Promise<T>): Promise<T> {
    const pool = await this.acquire(assertTenantId(tenantId));

    try {
      return await work(pool.knex);
    } finally {
      pool.leases -= 1;
      this.wake();
    }
  }

  /** The tenants whose pool is open, least recently used first. */
  tenants(): readonly string[] {
    return [...this.pools.keys()];
  }

  async close(): Promise<void> {
    const all = [...this.pools.values()];

    this.pools.clear();
    await Promise.all([...all.map((pool) => pool.knex.destroy()), ...this.draining]);
  }

  /** The instance of the tenant, most recently used now; once the bound has room for it when it has none. */
  private async acquire(tenantId: string): Promise<TenantPool> {
    const pool = this.pools.get(tenantId) ?? this.openedWithinBound(tenantId);

    if (pool === undefined) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));

      return this.acquire(tenantId);
    }

    this.pools.delete(tenantId);
    this.pools.set(tenantId, pool);
    pool.leases += 1;

    return pool;
  }

  /** A new instance when the bound has room, after closing an idle one if it must; `undefined` to wait. */
  private openedWithinBound(tenantId: string): TenantPool | undefined {
    const limit = this.options.maxTenants ?? DEFAULT_MAX_TENANTS;

    if (this.pools.size + this.draining.size < limit) {
      return { knex: (this.options.open ?? knex)(this.options.connectionOf(tenantId)), leases: 0 };
    }

    const idle = [...this.pools].find(([, pool]) => pool.leases === 0);

    if (idle !== undefined) {
      this.drain(idle[0], idle[1]);
    }

    return undefined;
  }

  private drain(tenantId: string, pool: TenantPool): void {
    this.pools.delete(tenantId);

    const drained: Promise<void> = pool.knex.destroy().finally(() => {
      this.draining.delete(drained);
      this.wake();
    });

    this.draining.add(drained);
  }

  private wake(): void {
    const waiting = this.waiting;

    this.waiting = [];

    for (const resolve of waiting) {
      resolve();
    }
  }
}
