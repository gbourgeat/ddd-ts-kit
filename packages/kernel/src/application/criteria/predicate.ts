import type { FilterOperand } from './filter-node.js';
import type { FilterOperator } from './filter-operator.js';

/**
 * One comparison of a field. It never holds on a `null`, `isNull` apart; `negated` holds when
 * the value is not `null` and the comparison fails, which is what `NOT (...)` means in SQL.
 */
export interface PredicateTest {
  readonly kind: 'test';
  readonly field: string;
  readonly operator: FilterOperator;
  readonly value: FilterOperand;
  readonly negated: boolean;
}

export interface PredicateGroup {
  readonly kind: 'and' | 'or';
  readonly parts: readonly Predicate[];
}

/**
 * The filters of a read as a store runs them: `and`, `or` and tests, every `not` pushed down
 * to the tests. A translator renders this tree and nothing else.
 */
export type Predicate = PredicateTest | PredicateGroup;
