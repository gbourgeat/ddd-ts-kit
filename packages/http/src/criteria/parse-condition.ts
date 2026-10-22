import type { FieldDeclaration, FieldValue, FilterNode, FilterOperator } from '@ddd-ts-kit/kernel';
import { coerceValue } from './coerce-value';
import { splitList } from './split-list';

const OPERATORS: readonly FilterOperator[] = [
  'eq',
  'ne',
  'in',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'startsWith',
  'isNull',
  'between',
];

const WRITTEN = /^([A-Za-z]+)(?::(.*))?$/s;

interface Written {
  readonly operator: FilterOperator;
  readonly text: string;
}

/**
 * The condition `<operator>:<value>` writes on a field, `undefined` when a value does not read
 * as the type of the field. Without an operator the text is the value of `eq`.
 */
export function parseCondition(field: string, declared: FieldDeclaration, text: string): FilterNode | undefined {
  const { operator, text: rest } = writtenOf(text);
  const value = operandOf(declared, operator, rest);

  return value === undefined ? undefined : { kind: 'condition', field, operator, value };
}

function writtenOf(text: string): Written {
  const [, name, rest] = WRITTEN.exec(text) ?? [];
  const operator = OPERATORS.find((known) => known === name);

  if (operator === undefined || (rest === undefined && operator !== 'isNull')) {
    return { operator: 'eq', text };
  }

  return { operator, text: rest ?? 'true' };
}

function operandOf(
  declared: FieldDeclaration,
  operator: FilterOperator,
  text: string,
): FieldValue | FieldValue[] | undefined {
  switch (operator) {
    case 'isNull':
      return coerceValue('boolean', text);
    case 'contains':
    case 'startsWith':
      return text;
    case 'in':
    case 'between':
      return listOf(declared, text);
    default:
      return coerceValue(declared.type, text);
  }
}

function listOf(declared: FieldDeclaration, text: string): FieldValue[] | undefined {
  const values = splitList(text).flatMap((item) => coerceValue(declared.type, item) ?? []);

  return values.length === splitList(text).length ? values : undefined;
}
