import type { ExecutionScope } from '@ddd-ts-kit/kernel';

/** What the contract takes its locks through: the two helpers of an ORM package on one database. */
export interface AdvisoryLockUnderContract {
  /** Runs `work` in a unit of work; two calls at the same time are two transactions. */
  run<T>(work: () => Promise<T>): Promise<T>;
  /** `advisoryLock(context, key, { tenant })`. */
  lock(key: string, tenant?: ExecutionScope): Promise<void>;
  /** `tryAdvisoryLock(context, key, { tenant })`. */
  tryLock(key: string, tenant?: ExecutionScope): Promise<boolean>;
  /** How many advisory locks the transaction of the unit of work in progress holds, none outside of one. */
  held(): Promise<number>;
}
