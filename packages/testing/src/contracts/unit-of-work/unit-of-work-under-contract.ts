import type { UnitOfWork } from '@ddd-ts-kit/kernel';
import type { Awaitable } from '../awaitable';
import type { OutboxStoreUnderContract } from '../outbox-store-contract';

/**
 * A unit of work with one table of its database, empty, and the outbox store of that database
 * bound to it. The table holds an identifier under a primary key, and a reference to a row of
 * the same table that the database checks at commit only (a deferred constraint).
 */
export interface UnitOfWorkUnderContract {
  readonly unitOfWork: UnitOfWork;
  readonly outbox: Pick<OutboxStoreUnderContract, 'append' | 'claimBatch' | 'stats'>;
  /** Writes a row through the unit of work: in its transaction inside `run`. Rejects when the id is taken. */
  insert(id: string): Promise<void>;
  /** Writes a row the database takes now and refuses when the transaction commits. */
  insertRefusedAtCommit(id: string): Promise<void>;
  /** The ids the unit of work sees, sorted: inside `run`, what its transaction wrote included. */
  ids(): Promise<string[]>;
  /** The ids another connection sees: committed rows only. Given where the database serves several connections. */
  committedIds?(): Promise<string[]>;
  close?(): Awaitable<void>;
}
