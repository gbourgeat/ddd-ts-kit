import type { ReadModelTable, UnitOfWork } from '@ddd-ts-kit/kernel';
import type { Awaitable } from '../awaitable.js';
import type { CriteriaContractRow } from '../criteria/criteria-contract-row.js';

export interface ReadModelStoreUnderContract {
  /** The table of `CriteriaContractRow`, empty. */
  readonly table: ReadModelTable<CriteriaContractRow>;
  /** The unit of work of its database: the swap of a rebuild runs in it. */
  readonly unitOfWork: UnitOfWork;
  close?(): Awaitable<void>;
}
