import { AsyncLocalStorage } from 'node:async_hooks';
import type { Knex } from 'knex';
import { tenantScopeOf, withinUnitOfWork, type ExecutionScope } from '@ddd-ts-kit/kernel';
import type { KnexUnitOfWork } from '../unit-of-work/create-knex-unit-of-work.js';
import type { TenantDatabases } from './tenant-databases.js';

/**
 * The unit of work of the database-per-tenant strategy: each transaction opens on the database
 * of the tenant of the work in progress, and `executor()` answers that transaction, or that
 * database outside of one. Work that names no tenant reaches no database
 * (`NoCurrentTenantError`): there is no default to fall back to.
 */
export function createTenantRoutedUnitOfWork(
  databases: TenantDatabases,
  scope: ExecutionScope,
  config?: Knex.TransactionConfig,
): KnexUnitOfWork {
  const current = new AsyncLocalStorage<Knex.Transaction>();
  const database = (): Knex => databases.knexOf(tenantScopeOf(scope).tenantId);

  return {
    run<T>(work: () => Promise<T>): Promise<T> {
      return withinUnitOfWork(work, (scoped) => {
        if (current.getStore() !== undefined) {
          return scoped();
        }

        return database().transaction((transaction) => current.run(transaction, scoped), config);
      });
    },
    executor: () => current.getStore() ?? database(),
    inTransaction: () => current.getStore() !== undefined,
  };
}
