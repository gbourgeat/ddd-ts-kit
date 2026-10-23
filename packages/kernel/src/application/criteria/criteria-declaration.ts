import type { Sort } from '../pagination/sort';
import type { CriteriaLimits } from './criteria-limits';
import type { FieldOf } from './field-of';
import type { FieldRule } from './field-rule';

/** What a read port writes to say which reads of its read model it accepts. */
export interface CriteriaDeclaration<Row> {
  /** The fields a criteria may name. A field left out can be neither filtered nor sorted. */
  readonly fields: { readonly [Field in FieldOf<Row> & keyof Row]?: FieldRule<Row[Field]> };
  /** The order of a read that asks for none. Default: the tie-breaker, ascending. */
  readonly defaultSort?: readonly Sort<FieldOf<Row>>[];
  /** A declared field that is unique and never null: it ends every sort, so that the order is total. */
  readonly tieBreaker: FieldOf<Row>;
  readonly limits?: Partial<CriteriaLimits>;
}
