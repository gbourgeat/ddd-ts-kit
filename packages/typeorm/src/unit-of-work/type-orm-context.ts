import type { EntityManager } from 'typeorm';

/**
 * Gives adapters the right entity manager to run their queries on: the transactional manager
 * of the current unit of work when there is one, `dataSource.manager` otherwise. Repositories
 * depend on this and never receive a transaction as a parameter.
 */
export abstract class TypeOrmContext {
  static readonly tokenKey = 'typeorm.TypeOrmContext';

  abstract manager(): EntityManager;

  abstract inTransaction(): boolean;
}
