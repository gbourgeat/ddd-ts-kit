import type { FieldDeclaration } from './field-declaration.js';
import type { FilterCondition, FilterNode } from './filter-node.js';
import type { Predicate } from './predicate.js';

type Fields = Readonly<Record<string, FieldDeclaration>>;

/** The filters, joined by AND, without any `not`: `undefined` when there is nothing to hold. */
export function predicateOf(filters: readonly FilterNode[], fields: Fields): Predicate | undefined {
  return filters.length === 0
    ? undefined
    : joined(
        'and',
        filters.map((node) => normalized(node, { negate: false, fields })),
      );
}

interface Reading {
  readonly negate: boolean;
  readonly fields: Fields;
}

function normalized(node: FilterNode, { negate, fields }: Reading): Predicate {
  if (node.kind === 'condition') {
    return negate ? refuted(node, fields[node.field]?.nullable === true) : { ...test(node), negated: false };
  }

  const inside = node.kind === 'not' ? !negate : negate;
  const joins = node.kind === 'or' ? 'or' : 'and';

  return joined(
    inside ? opposite(joins) : joins,
    node.filters.map((inner) => normalized(inner, { negate: inside, fields })),
  );
}

/** In two-valued logic, the opposite of a comparison also holds on `null`, where the field may hold one. */
function refuted(condition: FilterCondition, nullable: boolean): Predicate {
  if (condition.operator === 'isNull') {
    return { ...test(condition), value: condition.value !== true, negated: false };
  }

  const failing: Predicate = { ...test(condition), negated: true };

  return nullable
    ? {
        kind: 'or',
        parts: [{ kind: 'test', field: condition.field, operator: 'isNull', value: true, negated: false }, failing],
      }
    : failing;
}

function test({ field, operator, value }: FilterCondition): Omit<Extract<Predicate, { kind: 'test' }>, 'negated'> {
  return { kind: 'test', field, operator, value };
}

function opposite(joins: 'and' | 'or'): 'and' | 'or' {
  return joins === 'and' ? 'or' : 'and';
}

function joined(kind: 'and' | 'or', parts: readonly Predicate[]): Predicate {
  const [only] = parts;

  return parts.length === 1 && only !== undefined ? only : { kind, parts };
}
