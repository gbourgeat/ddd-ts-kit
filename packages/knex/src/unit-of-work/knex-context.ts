import type { Knex } from 'knex';

/**
 * Gives adapters the right handle to run their queries on: the transaction of the current
 * unit of work when there is one, the root knex instance otherwise. Repositories depend on
 * this and never receive a transaction as a parameter. A knex transaction is a `Knex`, hence
 * the single return type.
 */
export abstract class KnexContext {
  static readonly tokenKey = 'knex.KnexContext';

  abstract executor(): Knex;

  abstract inTransaction(): boolean;
}
