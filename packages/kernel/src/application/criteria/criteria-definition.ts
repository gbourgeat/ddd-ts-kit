import type { Sort } from '../pagination/sort';
import type { CriteriaLimits } from './criteria-limits';
import type { FieldDeclaration } from './field-declaration';
import type { FieldOf } from './field-of';

/** A `CriteriaDeclaration` once checked by `defineCriteria`: frozen, every default filled in. */
export interface CriteriaDefinition<Row> {
  readonly fields: Readonly<Record<string, FieldDeclaration>>;
  readonly defaultSort: readonly Sort<FieldOf<Row>>[];
  readonly tieBreaker: FieldOf<Row>;
  readonly limits: CriteriaLimits;
}
