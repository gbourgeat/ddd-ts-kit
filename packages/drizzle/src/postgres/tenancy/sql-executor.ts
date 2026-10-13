import type { SQL } from 'drizzle-orm';

/** What runs one statement: a drizzle database or transaction, whatever its driver. */
export interface SqlExecutor {
  execute(query: SQL): PromiseLike<unknown>;
}
