import type { Sort } from '../pagination/sort.js';
import type { CriteriaDeclaration } from './criteria-declaration.js';
import { CriteriaDefinitionError } from './criteria-definition-error.js';
import type { CriteriaDefinition } from './criteria-definition.js';
import { DEFAULT_CRITERIA_LIMITS, type CriteriaLimits } from './criteria-limits.js';
import type { FieldDeclaration } from './field-declaration.js';
import { fieldDeclarationOf } from './field-declaration-of.js';
import type { FieldOf } from './field-of.js';

type Fields = Readonly<Record<string, FieldDeclaration>>;

/**
 * What a read port accepts, checked when the file loads:
 * `defineCriteria<AppointmentRow>({ fields: { status: { type: 'string', filter: ['eq', 'in'] } }, tieBreaker: 'id' })`.
 * The compiler checks the field names, the type of each and the operators against the row.
 */
export function defineCriteria<Row>(declared: CriteriaDeclaration<Row>): CriteriaDefinition<Row> {
  const entries: [string, unknown][] = Object.entries(declared.fields);

  const fields: Fields = Object.freeze(
    Object.fromEntries(entries.map(([field, rule]) => [field, fieldDeclarationOf(field, rule)])),
  );

  const defaultSort = Object.freeze([...(declared.defaultSort ?? [])]);

  assertTieBreaker(fields, declared.tieBreaker);
  assertSortable(fields, defaultSort, declared.tieBreaker);

  return Object.freeze({
    fields,
    defaultSort,
    tieBreaker: declared.tieBreaker,
    limits: limitsOf(declared.limits ?? {}),
  });
}

function assertTieBreaker(fields: Fields, tieBreaker: string): void {
  const declared = Object.hasOwn(fields, tieBreaker) ? fields[tieBreaker] : undefined;

  if (declared === undefined) {
    throw new CriteriaDefinitionError(
      `The tie-breaker "${tieBreaker}" of a criteria definition is not one of its fields.`,
    );
  }

  if (declared.nullable) {
    throw new CriteriaDefinitionError(
      `The tie-breaker "${tieBreaker}" of a criteria definition may be null: it cannot end a total order.`,
    );
  }
}

function assertSortable<Row>(fields: Fields, sort: readonly Sort<FieldOf<Row>>[], tieBreaker: string): void {
  for (const { field } of sort) {
    const sortable = field === tieBreaker || (Object.hasOwn(fields, field) && fields[field]?.sortable === true);

    if (!sortable) {
      throw new CriteriaDefinitionError(
        `The default sort of a criteria definition names "${field}", which is not declared sortable.`,
      );
    }
  }
}

function limitsOf(declared: Partial<CriteriaLimits>): CriteriaLimits {
  const limits = { ...DEFAULT_CRITERIA_LIMITS, ...declared };
  const sizes = [limits.defaultPageSize, limits.maxPageSize, limits.maxInList, limits.maxFilters];

  if (
    !sizes.every((size) => Number.isSafeInteger(size) && size >= 1) ||
    !Number.isSafeInteger(limits.maxDepth) ||
    limits.maxDepth < 0
  ) {
    throw new CriteriaDefinitionError(
      'The limits of a criteria definition are positive integers, and the depth is zero or more.',
    );
  }

  if (limits.defaultPageSize > limits.maxPageSize) {
    throw new CriteriaDefinitionError('The default page size of a criteria definition is above its maximum page size.');
  }

  return Object.freeze(limits);
}
