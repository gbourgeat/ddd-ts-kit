import type { Knex } from 'knex';
import type { FieldValue, Predicate, PredicateTest } from '@ddd-ts-kit/kernel';
import { columnOf } from './column-of.js';
import { likePattern } from './like-pattern.js';

type Columns = Readonly<Record<string, string>>;

const COMPARISONS = { eq: '=', ne: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' } as const;

/**
 * Adds a predicate of a criteria plan to a query, as one parenthesised condition. Every
 * value is a binding and every column comes from the mapping of the adapter: nothing a caller
 * wrote is ever part of the statement.
 */
export function predicateToKnex<Builder extends Knex.QueryBuilder>(builder: Builder, predicate: Predicate | undefined, columns: Columns): Builder {
  if (predicate === undefined) return builder;

  void builder.where((group) => {
    held(group, predicate, columns);
  });

  return builder;
}

function held(builder: Knex.QueryBuilder, predicate: Predicate, columns: Columns): void {
  if (predicate.kind === 'test') {
    tested(builder, predicate, columnOf(columns, predicate.field));

    return;
  }

  for (const part of predicate.parts) {
    const nested = (group: Knex.QueryBuilder): void => {
      held(group, part, columns);
    };

    void (predicate.kind === 'and' ? builder.andWhere(nested) : builder.orWhere(nested));
  }
}

function tested(builder: Knex.QueryBuilder, test: PredicateTest, column: string): void {
  if (test.operator === 'isNull') {
    void (test.value === true ? builder.whereNull(column) : builder.whereNotNull(column));
  } else if (test.negated) {
    void builder.whereNot((refuted) => {
      compared(refuted, test, column);
    });
  } else {
    compared(builder, test, column);
  }
}

function compared(builder: Knex.QueryBuilder, { operator, value }: PredicateTest, column: string): void {
  const values: FieldValue[] = typeof value === 'object' && !(value instanceof Date) ? [...value] : [value];
  const [first = null, second = null] = values;

  switch (operator) {
    case 'in':
      void builder.whereIn(column, values);
      break;
    case 'between':
      void builder.whereBetween(column, [first, second]);
      break;
    case 'contains':
    case 'startsWith':
      void builder.whereRaw('?? like ? escape ?', [column, likePattern(operator, String(first)), '\\']);
      break;
    case 'isNull':
      break;
    default:
      void builder.where(column, COMPARISONS[operator], first);
  }
}
