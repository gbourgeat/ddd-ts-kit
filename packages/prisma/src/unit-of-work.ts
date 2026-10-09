import { AsyncLocalStorage } from 'node:async_hooks';
import type { UnitOfWork } from '@ddd-ts-kit/kernel';

/**
 * The part of a Prisma client the unit of work calls: the interactive form of `$transaction`.
 * Typed structurally, so the package depends on no generated client. `Tx` is the transaction
 * client of your own client (`Prisma.TransactionClient`), `Options` its transaction options.
 */
export interface PrismaTransactionHost<Tx, Options = never> {
  $transaction<R>(work: (transaction: Tx) => Promise<R>, options?: Options): Promise<R>;
}

/**
 * The transaction client of a client, for typing a context without naming the generated
 * type: `PrismaContext<PrismaTransactionClient<typeof prisma>>`. For a plain client it is
 * `Prisma.TransactionClient`; an extended client (`$extends`) has a type of its own.
 */
export type PrismaTransactionClient<Client> =
  Client extends PrismaTransactionHost<infer Tx, never> ? Tx : never;

/**
 * Gives adapters the right client to run their queries on: the transaction client of the
 * current unit of work when there is one, the root client otherwise. Repositories depend on
 * this and never receive a transaction as a parameter. The root client offers everything a
 * transaction client does, hence the single return type.
 */
export interface PrismaContext<Tx> {
  client(): Tx;
  inTransaction(): boolean;
}

export interface PrismaUnitOfWork<Tx> extends UnitOfWork, PrismaContext<Tx> {}

/**
 * A unit of work over the interactive `$transaction` of Prisma. The transaction client travels
 * in an AsyncLocalStorage owned by this unit of work, so two clients never see each other's
 * transaction. A nested `run` joins the outer transaction: it commits or rolls back as a whole.
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
      if (current.getStore() !== undefined) {
        return work();
      }
      return client.$transaction(
        (transaction) => current.run({ transaction }, work),
        options,
      );
    },
    client: () => current.getStore()?.transaction ?? client,
    inTransaction: () => current.getStore() !== undefined,
  };
}
