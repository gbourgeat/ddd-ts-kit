import { PrismaContext } from '../../../../src';
import type { Prisma } from '../../../generated/client/client';

/** The database of the project, as its repositories name it in their dependency list. */
export abstract class Database extends PrismaContext<Prisma.TransactionClient> {}
