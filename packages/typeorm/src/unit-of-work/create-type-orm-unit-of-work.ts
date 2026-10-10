import { AsyncLocalStorage } from 'node:async_hooks';
import type { DataSource, EntityManager } from 'typeorm';
import type { UnitOfWork } from '@ddd-ts-kit/kernel';
import type { TypeOrmContext } from './type-orm-context.js';

/** The isolation levels TypeORM accepts, restated so the signature reads without a deep import. */
export type TypeOrmIsolationLevel = Parameters<DataSource['transaction']>[0];

/** One object for both ports: bind it to `UnitOfWork` and to `TypeOrmContext`. */
export interface TypeOrmUnitOfWork extends UnitOfWork, TypeOrmContext {}

/**
 * A unit of work over `dataSource.transaction`. The transactional manager travels in an
 * AsyncLocalStorage owned by this unit of work, so two data sources never see each other's
 * transaction. A nested `run` joins the outer transaction: it commits or rolls back as a whole.
 */
export function createTypeOrmUnitOfWork(
  dataSource: DataSource,
  isolationLevel?: TypeOrmIsolationLevel,
): TypeOrmUnitOfWork {
  const current = new AsyncLocalStorage<EntityManager>();

  return {
    run<T>(work: () => Promise<T>): Promise<T> {
      if (current.getStore() !== undefined) {
        return work();
      }

      const inTransaction = (manager: EntityManager): Promise<T> => current.run(manager, work);

      return isolationLevel === undefined
        ? dataSource.transaction(inTransaction)
        : dataSource.transaction(isolationLevel, inTransaction);
    },
    manager: () => current.getStore() ?? dataSource.manager,
    inTransaction: () => current.getStore() !== undefined,
  };
}
