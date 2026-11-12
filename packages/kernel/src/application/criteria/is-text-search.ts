import type { FilterOperator } from './filter-operator';
import type { TextSearch } from './text-search';

const TEXT_SEARCHES: readonly FilterOperator[] = [
  'contains',
  'startsWith',
  'containsIgnoringCase',
  'startsWithIgnoringCase',
] satisfies readonly TextSearch[];

/** Whether an operator searches a text in a string: its operand is then a text, never empty. */
export function isTextSearch(operator: FilterOperator): operator is TextSearch {
  return TEXT_SEARCHES.includes(operator);
}
