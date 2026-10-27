import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '{{alias.generated}}/prisma/client{{alias.ext}}';

export interface ConnectionOptions {
  /** A single-session database (the in-process one of the tests) needs 1. */
  readonly poolSize?: number;
}

/** The client connects on the first query. Run `npm run db:client` after a change of a file of prisma/schema/. */
export function createClient(url: string, options: ConnectionOptions = {}): PrismaClient {
  const pool = options.poolSize === undefined ? {} : { max: options.poolSize };

  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, ...pool }) });
}
