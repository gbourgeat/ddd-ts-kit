import { AsyncLocalStorage } from 'node:async_hooks';
import type { Knex } from 'knex';
import type { UnitOfWork } from '@ddd-ts-kit/kernel';
import type { KnexContext } from './knex-context.js';

/** One object for both ports: bind it to `UnitOfWork` and to `KnexContext`. */
export interface KnexUnitOfWork extends UnitOfWork, KnexContext {}

/**
 * A unit of work over `knex.transaction`. The transaction travels in an AsyncLocalStorage
 * owned by this unit of work, so two databases never see each other's transaction. A nested
 * `run` joins the outer transaction: it commits or rolls back as a whole.
 */
export function createKnexUnitOfWork(knex: Knex, config?: Knex.TransactionConfig): KnexUnitOfWork {
  const current = new AsyncLocalStorage<Knex.Transaction>();

  return {
    run<T>(work: () => Promise<T>): Promise<T> {
      if (current.getStore() !== undefined) {
        return work();
      }

      return knex.transaction((transaction) => current.run(transaction, work), config);
    },
    executor: () => current.getStore() ?? knex,
    inTransaction: () => current.getStore() !== undefined,
  };
}
