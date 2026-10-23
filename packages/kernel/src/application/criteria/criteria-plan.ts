import type { Sort } from '../pagination/sort';
import type { FieldDeclaration } from './field-declaration';
import type { Predicate } from './predicate';

/**
 * A validated read, ready for a store: what a translator renders. Everything a caller wrote
 * has been checked against the definition, and the scope of the actor is already joined in.
 */
export interface CriteriaPlan {
  /** The actor may read nothing: answer `pageOfPlan(plan, [])` without querying. */
  readonly empty: boolean;
  /** The declared fields, for the type of each. */
  readonly fields: Readonly<Record<string, FieldDeclaration>>;
  /** The filters of the caller and the scope of the actor: what a total counts. */
  readonly filter: Predicate | undefined;
  /** The rows after the cursor, for a cursor page that is not the first. */
  readonly seek: Predicate | undefined;
  /** A total order: the tie-breaker of the definition ends it. */
  readonly sort: readonly Sort[];
  readonly kind: 'offset' | 'cursor';
  /** The size of the page. */
  readonly limit: number;
  /** The rows to fetch: one more than the page for a cursor page, which tells whether another follows. */
  readonly fetch: number;
  readonly offset: number;
}
