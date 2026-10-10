import type { PrismaTransactionHost } from './prisma-transaction-host.js';

/**
 * The transaction client of a client, for typing a context without naming the generated
 * type: `PrismaContext<PrismaTransactionClient<typeof prisma>>`. For a plain client it is
 * `Prisma.TransactionClient`; an extended client (`$extends`) has a type of its own.
 */
export type PrismaTransactionClient<Client> = Client extends PrismaTransactionHost<infer Tx, never> ? Tx : never;
