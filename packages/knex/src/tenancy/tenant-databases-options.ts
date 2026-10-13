import type { Knex } from 'knex';

export interface TenantDatabasesOptions {
  /** The connection of a tenant's database: its own configuration, pool included (keep `pool.max` small). */
  readonly connectionOf: (tenantId: string) => Knex.Config;
  /**
   * How many tenants have an instance at once, those being closed included: an idle one, the
   * least recently used, is closed when a new tenant needs one, and work waits when every
   * instance is held. Default 20. The connections the server must accept are at most
   * `maxTenants * pool.max` per instance of the application.
   */
  readonly maxTenants?: number;
  /** Builds a knex instance; default `knex(config)`. */
  readonly open?: (config: Knex.Config) => Knex;
}
