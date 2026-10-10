/**
 * The part of a Prisma client the unit of work calls: the interactive form of `$transaction`.
 * Typed structurally, so the package depends on no generated client. `Tx` is the transaction
 * client of your own client (`Prisma.TransactionClient`), `Options` its transaction options.
 */
export interface PrismaTransactionHost<Tx, Options = never> {
  $transaction<R>(work: (transaction: Tx) => Promise<R>, options?: Options): Promise<R>;
}
