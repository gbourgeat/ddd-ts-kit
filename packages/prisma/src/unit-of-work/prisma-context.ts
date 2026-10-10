/**
 * Gives adapters the right client to run their queries on: the transaction client of the
 * current unit of work when there is one, the root client otherwise. Repositories depend on
 * this and never receive a transaction as a parameter. The root client offers everything a
 * transaction client does, hence the single return type.
 *
 * Generic over the transaction client of the generated client, so it is not an injection token
 * by itself: the project names its database with a class of its own,
 * `export abstract class Database extends PrismaContext<Prisma.TransactionClient> {}`.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- the parameter is what a project fixes when it extends this class with its own transaction client
export abstract class PrismaContext<Tx> {
  abstract client(): Tx;

  abstract inTransaction(): boolean;
}
