import {
  and,
  between,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  not,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import {
  isTextSearch,
  type FieldValue,
  type FilterOperand,
  type FilterOperator,
  type Predicate,
  type PredicateTest,
} from '@ddd-ts-kit/kernel';
import { columnOf } from './column-of';
import { likePattern } from './like-pattern';

type Columns = Readonly<Record<string, PgColumn>>;

/** The operators that compare a value: `isNull` is rendered before any of them. */
type Comparison = Exclude<FilterOperator, 'isNull'>;

/** A search that ignores case is an `ilike`: PostgreSQL folds it with the locale of the database, see `foldCase` of the kernel. */
const LIKE = {
  contains: sql`like`,
  startsWith: sql`like`,
  containsIgnoringCase: sql`ilike`,
  startsWithIgnoringCase: sql`ilike`,
} as const;

const COMPARISONS = { eq, ne, gt, gte, lt, lte } as const;

/**
 * A predicate of a criteria plan as a drizzle condition. Every value is a parameter, encoded
 * by its column, and every column comes from the mapping of the adapter: nothing a caller
 * wrote is ever part of the statement.
 */
export function predicateToDrizzle(predicate: Predicate | undefined, columns: Columns): SQL | undefined {
  if (predicate === undefined) {
    return undefined;
  }

  if (predicate.kind === 'test') {
    return tested(predicate, columnOf(columns, predicate.field));
  }

  const parts = predicate.parts.map((part) => predicateToDrizzle(part, columns));

  return predicate.kind === 'and' ? and(...parts) : or(...parts);
}

function tested(test: PredicateTest, column: PgColumn): SQL {
  if (test.operator === 'isNull') {
    return test.value === true ? isNull(column) : isNotNull(column);
  }

  const comparison = compared(test.operator, test.value, column);

  return test.negated ? not(comparison) : comparison;
}

function compared(operator: Comparison, value: FilterOperand, column: PgColumn): SQL {
  const values: FieldValue[] = typeof value === 'object' && !(value instanceof Date) ? [...value] : [value];
  const [first = null, second = null] = values;

  if (isTextSearch(operator)) {
    return sql`${column} ${LIKE[operator]} ${likePattern(operator, String(first))} escape ${'\\'}`;
  }

  switch (operator) {
    case 'in':
      return inArray(column, values);
    case 'between':
      return between(column, first, second);
    default:
      return COMPARISONS[operator](column, first);
  }
}
