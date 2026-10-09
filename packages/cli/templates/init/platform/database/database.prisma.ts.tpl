import { PrismaPg } from '@prisma/adapter-pg';
import type { PrismaContext } from '@ddd-ts-kit/prisma';
import { PrismaClient, type Prisma } from '{{paths.databaseToGenerated}}/prisma/client.js';

export type Database = PrismaClient;
export type DatabaseContext = PrismaContext<Prisma.TransactionClient>;

export interface ConnectionOptions {
  /** A single-session database (the in-process one of the tests) needs 1. */
  readonly poolSize?: number;
}

/** The client connects on the first query. Run `npm run db:client` after a change of prisma/schema.prisma. */
export function createClient(url: string, options: ConnectionOptions = {}): Database {
  const pool = options.poolSize === undefined ? {} : { max: options.poolSize };
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, ...pool }) });
}
