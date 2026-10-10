import type { Knex } from 'knex';

/** The `KnexContext` of `@ddd-ts-kit/knex`, restated structurally: any unit of work of that package fits. */
export interface KnexAuditContext {
  executor(): Knex;
}
