import { PrismaContext } from '@ddd-ts-kit/prisma';
import type { Prisma } from '{{alias.generated}}/prisma/client.js';

/** The storage of the application, as a repository adapter names it in its dependency list: the transaction client of the current unit of work, or the root client. */
export abstract class Database extends PrismaContext<Prisma.TransactionClient> {}
