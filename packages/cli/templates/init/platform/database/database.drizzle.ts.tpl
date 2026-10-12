import type { PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { DrizzleContext } from '@ddd-ts-kit/drizzle/postgres';

/**
 * The storage of the application, as a repository adapter types its constructor parameter by it. Typed
 * on the driver-neutral base, so that the same repositories run on node-postgres in production
 * and on PGlite in the tests.
 */
export abstract class Database extends DrizzleContext<PgQueryResultHKT> {}
