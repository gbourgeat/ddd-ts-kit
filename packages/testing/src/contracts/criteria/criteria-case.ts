import type { Criteria, ReadScope } from '@ddd-ts-kit/kernel';
import type { CriteriaContractRow } from './criteria-contract-row.js';

/** One line of the contract: a read, and the ids it answers, in order. */
export interface CriteriaCase {
  readonly name: string;
  readonly read: (criteria: Criteria<CriteriaContractRow>) => Criteria<CriteriaContractRow>;
  /** What the actor may read. Everything by default. */
  readonly scope?: ReadScope;
  readonly ids: readonly string[];
}
