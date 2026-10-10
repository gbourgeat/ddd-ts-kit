import { AsyncLocalStorage } from 'node:async_hooks';
import { withinUnitOfWork, type UnitOfWork } from '@ddd-ts-kit/kernel';
import type { PrismaContext } from './prisma-context.js';
import type { PrismaTransactionHost } from './prisma-transaction-host.js';

/** One object for both ports: bind it to `UnitOfWork` and to the `PrismaContext` of the project. */
export interface PrismaUnitOfWork<Tx> extends UnitOfWork, PrismaContext<Tx> {}

/**
 * A unit of work over the interactive `$transaction` of Prisma. The transaction client travels
 * in an AsyncLocalStorage owned by this unit of work, so two clients never see each other's
 * transaction. A nested `run` joins the outer transaction: it commits or rolls back as a whole.
 * Domain events are dispatched at the end of the outermost `run`, before its commit
 * (`withinUnitOfWork`): their handlers run inside the time Prisma allows the transaction.
 *
 * Prisma bounds an interactive transaction in time (`timeout`, 5 seconds by default) and
 * rolls it back beyond: pass `options` to widen it for long commands.
 */
export function createPrismaUnitOfWork<Tx, Options>(
  // NoInfer: `Tx` is what `$transaction` hands out, and the root client must offer at least that.
  client: PrismaTransactionHost<Tx, Options> & NoInfer<Tx>,
  options?: Options,
): PrismaUnitOfWork<Tx> {
  const current = new AsyncLocalStorage<{ readonly transaction: Tx }>();

  return {
    run<T>(work: () => Promise<T>): Promise<T> {
      return withinUnitOfWork(work, (scoped) => {
        if (current.getStore() !== undefined) return scoped();

        return client.$transaction((transaction) => current.run({ transaction }, scoped), options);
      });
    },
    client: () => current.getStore()?.transaction ?? client,
    inTransaction: () => current.getStore() !== undefined,
  };
}
