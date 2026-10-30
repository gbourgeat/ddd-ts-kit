import { Brackets, NotBrackets, type WhereExpressionBuilder } from 'typeorm';
import type { FieldValue, FilterOperand, FilterOperator, Predicate, PredicateTest } from '@ddd-ts-kit/kernel';
import { likePattern } from './like-pattern';

export interface TypeOrmCriteriaOptions {
  /** The alias of the read model in the query. */
  readonly alias: string;
  /** The property of each field, when they differ: `{ startsAt: 'beginning' }`. A field left out is its own property. */
  readonly properties?: Readonly<Record<string, string>>;
  /** What the names of the parameters start with, unique among the predicates of one query. Default `criteria`. */
  readonly parameters?: string;
}

interface Rendering extends TypeOrmCriteriaOptions {
  /** Parameter names already given, so that each is unique in the query. */
  readonly names: string[];
}

const COMPARISONS = { eq: '=', ne: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' } as const;

/** The operators that compare a value: `isNull` is rendered before any of them. */
interface Comparison {
  readonly operator: Exclude<FilterOperator, 'isNull'>;
  readonly value: FilterOperand;
}

/**
 * Adds a predicate of a criteria plan to a query builder, as one parenthesised condition.
 * Every value is a named parameter; the only text composed here is `alias.property`, both
 * from the adapter, with an operator of a closed list: nothing a caller wrote is ever part of
 * the statement.
 */
export function predicateToTypeOrm<Builder extends WhereExpressionBuilder>(
  builder: Builder,
  predicate: Predicate | undefined,
  options: TypeOrmCriteriaOptions,
): Builder {
  if (predicate === undefined) {
    return builder;
  }

  const rendering: Rendering = { ...options, names: [] };

  return builder.andWhere(
    new Brackets((group) => {
      held(group, predicate, rendering);
    }),
  );
}

function held(builder: WhereExpressionBuilder, predicate: Predicate, rendering: Rendering): void {
  if (predicate.kind === 'test') {
    tested(builder, predicate, rendering);

    return;
  }

  for (const part of predicate.parts) {
    const nested = new Brackets((group) => {
      held(group, part, rendering);
    });

    if (predicate.kind === 'and') {
      builder.andWhere(nested);
    } else {
      builder.orWhere(nested);
    }
  }
}

function tested(builder: WhereExpressionBuilder, test: PredicateTest, rendering: Rendering): void {
  const column = `${rendering.alias}.${propertyOf(rendering, test.field)}`;

  if (test.operator === 'isNull') {
    builder.andWhere(test.value === true ? `${column} IS NULL` : `${column} IS NOT NULL`);

    return;
  }

  const comparison = { operator: test.operator, value: test.value };

  if (test.negated) {
    builder.andWhere(
      new NotBrackets((refuted) => {
        compared(refuted, comparison, { column, rendering });
      }),
    );
  } else {
    compared(builder, comparison, { column, rendering });
  }
}

interface Target {
  readonly column: string;
  readonly rendering: Rendering;
}

function compared(
  builder: WhereExpressionBuilder,
  { operator, value }: Comparison,
  { column, rendering }: Target,
): void {
  const values: FieldValue[] = typeof value === 'object' && !(value instanceof Date) ? [...value] : [value];
  const [first = null, second = null] = values;
  const [one, two] = [named(rendering), named(rendering)];

  switch (operator) {
    case 'in':
      builder.andWhere(`${column} IN (:...${one})`, { [one]: values });
      break;
    case 'between':
      builder.andWhere(`${column} BETWEEN :${one} AND :${two}`, { [one]: first, [two]: second });
      break;
    case 'contains':
    case 'startsWith':
      builder.andWhere(`${column} LIKE :${one} ESCAPE :${two}`, {
        [one]: likePattern(operator, String(first)),
        [two]: '\\',
      });

      break;
    default:
      builder.andWhere(`${column} ${COMPARISONS[operator]} :${one}`, { [one]: first });
  }
}

function named(rendering: Rendering): string {
  const name = `${rendering.parameters ?? 'criteria'}_${String(rendering.names.length)}`;

  rendering.names.push(name);

  return name;
}

function propertyOf({ properties = {} }: TypeOrmCriteriaOptions, field: string): string {
  return Object.hasOwn(properties, field) ? (properties[field] ?? field) : field;
}
