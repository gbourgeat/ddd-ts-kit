import type { Sort } from '../pagination/sort.js';
import type { CriteriaLimits } from './criteria-limits.js';
import type { FieldDeclaration } from './field-declaration.js';
import type { FieldOf } from './field-of.js';

/** A `CriteriaDeclaration` once checked by `defineCriteria`: frozen, every default filled in. */
export interface CriteriaDefinition<Row> {
  readonly fields: Readonly<Record<string, FieldDeclaration>>;
  readonly defaultSort: readonly Sort<FieldOf<Row>>[];
  readonly tieBreaker: FieldOf<Row>;
  readonly limits: CriteriaLimits;
}
