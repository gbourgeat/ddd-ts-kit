import type { ReadModelTable } from '@ddd-ts-kit/kernel';
import type { Awaitable } from '../awaitable';
import type { CriteriaContractRow } from '../criteria/criteria-contract-row';

export interface ReadModelRowsUnderContract {
  /** The table of `CriteriaContractRow`, empty. */
  readonly table: ReadModelTable<CriteriaContractRow>;
  close?(): Awaitable<void>;
}
