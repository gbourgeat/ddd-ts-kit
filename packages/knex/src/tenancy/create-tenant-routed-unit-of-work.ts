import { AsyncLocalStorage } from 'node:async_hooks';
import type { Knex } from 'knex';
import { tenantScopeOf, withinUnitOfWork, type ExecutionScope } from '@ddd-ts-kit/kernel';
import type { KnexUnitOfWork } from '../unit-of-work/create-knex-unit-of-work.js';
import { CrossTenantUnitOfWorkError } from './cross-tenant-unit-of-work-error.js';
import { StatementOutsideUnitOfWorkError } from './statement-outside-unit-of-work-error.js';
import type { TenantDatabases } from './tenant-databases.js';

/** The transaction open on the asynchronous call chain, and the tenant whose database it is on. */
interface OpenTransaction {
  readonly transaction: Knex.Transaction;
  readonly tenantId: string;
}

/**
 * The unit of work of the database-per-tenant strategy: each transaction opens on the database
 * of the tenant of the work in progress, holding a lease on it until it ends, and `executor()`
 * answers that transaction. Every statement runs inside `run` (`StatementOutsideUnitOfWorkError`
 * otherwise), work that names no tenant reaches no database (`NoCurrentTenantError`), and work
 * of another tenant never joins an open transaction (`CrossTenantUnitOfWorkError`).
 */
export function createTenantRoutedUnitOfWork(
  databases: TenantDatabases,
  scope: ExecutionScope,
  config?: Knex.TransactionConfig,
): KnexUnitOfWork {
  const current = new AsyncLocalStorage<OpenTransaction>();

  return {
    run<T>(work: () => Promise<T>): Promise<T> {
      return withinUnitOfWork(work, (scoped) => {
        const { tenantId } = tenantScopeOf(scope);
        const open = current.getStore();

        if (open !== undefined) {
          return open.tenantId === tenantId
            ? scoped()
            : Promise.reject(new CrossTenantUnitOfWorkError(open.tenantId, tenantId));
        }

        return databases.lease(tenantId, (database) =>
          database.transaction((transaction) => current.run({ transaction, tenantId }, scoped), config),
        );
      });
    },
    executor: () => {
      const open = current.getStore();

      if (open === undefined) {
        throw new StatementOutsideUnitOfWorkError();
      }

      return open.transaction;
    },
    inTransaction: () => current.getStore() !== undefined,
  };
}
