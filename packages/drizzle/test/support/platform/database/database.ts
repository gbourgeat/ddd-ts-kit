import type { PgliteQueryResultHKT } from 'drizzle-orm/pglite';
import { DrizzleContext } from '../../../../src/postgres';

/** The database of the project, as its repositories name it in their dependency list. */
export abstract class Database extends DrizzleContext<PgliteQueryResultHKT> {}
