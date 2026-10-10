import type { Sort } from '../pagination/sort.js';
import type { CursorValues } from './cursor-values.js';
import type { FieldDeclaration } from './field-declaration.js';
import type { FieldValue } from './field-value.js';
import type { Predicate } from './predicate.js';

/**
 * The rows that come after a position in a total order, as a predicate: the keyset of a cursor
 * page. For the sort `(a, b, id)` it reads "a is past, or a ties and b is past, or both tie and
 * id is past". A `null` is the greatest value: last ascending, first descending.
 */
export function seekPredicate(sort: readonly Sort[], position: CursorValues, fields: Readonly<Record<string, FieldDeclaration>>): Predicate {
  const parts = sort.flatMap((entry, index) => {
    const past = pastOf(entry, position[entry.field] ?? null, fields[entry.field]);
    const ties = sort.slice(0, index).map(({ field }) => tying(field, position[field] ?? null));

    return past === undefined ? [] : [all([...ties, past])];
  });

  return { kind: 'or', parts };
}

function pastOf({ field, direction }: Sort, value: FieldValue | null, declared: FieldDeclaration | undefined): Predicate | undefined {
  const beyond = value === null ? undefined : beyondOf(field, direction, value);

  if (direction === 'desc') return value === null ? test(field, 'isNull', false) : beyond;

  if (value === null || declared?.nullable !== true) return beyond;

  return any([...(beyond === undefined ? [] : [beyond]), test(field, 'isNull', true)]);
}

/** The values past one. A boolean has no order to a store: past `false` is `true`, and nothing is past `true`. */
function beyondOf(field: string, direction: Sort['direction'], value: FieldValue): Predicate | undefined {
  if (typeof value !== 'boolean') return test(field, direction === 'asc' ? 'gt' : 'lt', value);

  return value === (direction === 'desc') ? test(field, 'eq', !value) : undefined;
}

function tying(field: string, value: FieldValue | null): Predicate {
  return value === null ? test(field, 'isNull', true) : test(field, 'eq', value);
}

function test(field: string, operator: 'gt' | 'lt' | 'eq' | 'isNull', value: FieldValue): Predicate {
  return { kind: 'test', field, operator, value, negated: false };
}

function any(parts: readonly Predicate[]): Predicate {
  const [only] = parts;

  return parts.length === 1 && only !== undefined ? only : { kind: 'or', parts };
}

function all(parts: readonly Predicate[]): Predicate {
  const [only] = parts;

  return parts.length === 1 && only !== undefined ? only : { kind: 'and', parts };
}
