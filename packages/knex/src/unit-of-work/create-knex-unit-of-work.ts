import { AsyncLocalStorage } from 'node:async_hooks';
import type { Knex } from 'knex';
import { withinUnitOfWork, type UnitOfWork } from '@ddd-ts-kit/kernel';
import type { KnexContext } from './knex-context.js';

/** One object for both ports: bind it to `UnitOfWork` and to `KnexContext`. */
export interface KnexUnitOfWork extends UnitOfWork, KnexContext {}

export interface KnexUnitOfWorkOptions {
  /**
   * Runs first in each outermost transaction, before the work: `tenantSession(scope)` sets the
   * tenant settings row-level security reads, `tenantSearchPath` the schemas of the tenant.
   */
  readonly begin?: (transaction: Knex.Transaction) => Promise<void>;
}

/**
 * A unit of work over `knex.transaction`. The transaction travels in an AsyncLocalStorage
 * owned by this unit of work, so two databases never see each other's transaction. A nested
 * `run` joins the outer transaction: it commits or rolls back as a whole. Domain events are
 * dispatched at the end of the outermost `run`, before its commit (`withinUnitOfWork`).
 */
export function createKnexUnitOfWork(
  knex: Knex,
  config?: Knex.TransactionConfig,
  options: KnexUnitOfWorkOptions = {},
): KnexUnitOfWork {
  const current = new AsyncLocalStorage<Knex.Transaction>();
  const { begin } = options;

  return {
    run<T>(work: () => Promise<T>): Promise<T> {
      return withinUnitOfWork(work, (scoped) => {
        if (current.getStore() !== undefined) {
          return scoped();
        }

        const opened = async (transaction: Knex.Transaction): Promise<T> => {
          await begin?.(transaction);

          return scoped();
        };

        return knex.transaction((transaction) => current.run(transaction, () => opened(transaction)), config);
      });
    },
    executor: () => current.getStore() ?? knex,
    inTransaction: () => current.getStore() !== undefined,
  };
}
