import { compareValues } from './compare-values';
import type { FieldDeclaration } from './field-declaration';
import type { FieldType } from './field-type';
import type { Predicate, PredicateTest } from './predicate';

type Fields = Readonly<Record<string, FieldDeclaration>>;

/** Whether a row satisfies a predicate: the reference every translator is held to. */
export function holds(predicate: Predicate | undefined, row: object, fields: Fields): boolean {
  if (predicate === undefined) {
    return true;
  }

  if (predicate.kind === 'test') {
    return passes(predicate, row, fields[predicate.field]?.type ?? 'string');
  }

  return predicate.kind === 'and'
    ? predicate.parts.every((part) => holds(part, row, fields))
    : predicate.parts.some((part) => holds(part, row, fields));
}

function passes(test: PredicateTest, row: object, type: FieldType): boolean {
  const value: unknown = Reflect.get(row, test.field) ?? null;

  if (test.operator === 'isNull') {
    return (value === null) === test.value;
  }

  if (value === null) {
    return false;
  }

  return compares(test, value, type) !== test.negated;
}

function compares({ operator, value: operand }: PredicateTest, value: unknown, type: FieldType): boolean {
  const order = (other: unknown): number => compareValues(type, value, other);
  const operands: readonly unknown[] = Array.isArray(operand) ? operand : [operand];
  const [first, second] = operands;

  switch (operator) {
    case 'eq':
      return order(first) === 0;
    case 'ne':
      return order(first) !== 0;
    case 'in':
      return operands.some((candidate) => order(candidate) === 0);
    case 'between':
      return order(first) >= 0 && order(second) <= 0;
    case 'contains':
      return String(value).includes(String(first));
    case 'startsWith':
      return String(value).startsWith(String(first));
    default:
      return ordered(operator, order(first));
  }
}

function ordered(operator: 'gt' | 'gte' | 'lt' | 'lte' | 'isNull', order: number): boolean {
  switch (operator) {
    case 'gt':
      return order > 0;
    case 'gte':
      return order >= 0;
    case 'lt':
      return order < 0;
    default:
      return order <= 0;
  }
}
