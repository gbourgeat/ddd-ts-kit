import type { CriteriaContractRow } from '../criteria/criteria-contract-row';
import { criteriaContractRows } from '../criteria/criteria-contract-rows';

/** The row of the contract dataset with this id. */
export function rowOf(id: string): CriteriaContractRow {
  const found = criteriaContractRows().find((candidate) => candidate.id === id);

  if (found === undefined) {
    throw new Error(`The contract dataset holds no row ${id}`);
  }

  return found;
}
