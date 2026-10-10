export interface CriteriaLimits {
  readonly defaultPageSize: number;
  readonly maxPageSize: number;
  /** The longest list an `in` accepts from a caller. */
  readonly maxInList: number;
  /** How deep groups nest: 1 allows `or(a, b)`, 2 allows `or(and(a, b), c)`. */
  readonly maxDepth: number;
  /** The most conditions one criteria holds, groups included. */
  readonly maxFilters: number;
}

export const DEFAULT_CRITERIA_LIMITS: CriteriaLimits = Object.freeze({
  defaultPageSize: 20,
  maxPageSize: 100,
  maxInList: 100,
  maxDepth: 1,
  maxFilters: 20,
});
