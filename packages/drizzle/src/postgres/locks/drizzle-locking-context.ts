import type { SqlExecutor } from '../tenancy/sql-executor';

/** What an advisory lock needs of a `DrizzleContext`, whatever its driver and its schema. */
export interface DrizzleLockingContext {
  executor(): SqlExecutor;
  inTransaction(): boolean;
}
