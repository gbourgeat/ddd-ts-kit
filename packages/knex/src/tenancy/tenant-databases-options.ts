import type { Knex } from 'knex';

export interface TenantDatabasesOptions {
  /** The connection of a tenant's database: its own configuration, pool included (keep `pool.max` small). */
  readonly connectionOf: (tenantId: string) => Knex.Config;
  /**
   * How many tenants keep an open pool at once: the least recently used one is closed when a
   * new tenant needs a pool. Default 20. The connections the server must accept are about
   * `maxTenants * pool.max` per instance of the application.
   */
  readonly maxTenants?: number;
  /** Builds a knex instance; default `knex(config)`. */
  readonly open?: (config: Knex.Config) => Knex;
}
