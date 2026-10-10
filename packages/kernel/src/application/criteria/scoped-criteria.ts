import type { Criteria } from './criteria.js';
import type { FilterCondition } from './filter-node.js';

export interface ScopeRestriction {
  /** Conditions joined to the criteria by AND, on fields the read port chose. */
  readonly conditions: readonly FilterCondition[];
  /** The actor may read nothing: the read answers an empty page without touching the store. */
  readonly empty: boolean;
}

/**
 * A criteria and what the actor may read, kept apart. A read port asks for this type, so a
 * read cannot reach it without a scope, and nothing a caller does to the criteria removes the
 * restriction: `refine` changes the criteria only.
 */
export class ScopedCriteria<Row> {
  static within<Row>(criteria: Criteria<Row>, restriction: ScopeRestriction): ScopedCriteria<Row> {
    return new ScopedCriteria<Row>(
      criteria,
      Object.freeze({ ...restriction, conditions: Object.freeze([...restriction.conditions]) }),
    );
  }

  private constructor(
    readonly criteria: Criteria<Row>,
    readonly restriction: ScopeRestriction,
  ) {}

  refine(change: (criteria: Criteria<Row>) => Criteria<Row>): ScopedCriteria<Row> {
    return new ScopedCriteria<Row>(change(this.criteria), this.restriction);
  }
}
