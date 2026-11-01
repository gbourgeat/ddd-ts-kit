import type { FieldValue, Predicate, PredicateTest } from '@ddd-ts-kit/kernel';
import type { DocumentMapper } from '../mapping/document.mapper';

type Query = Readonly<Record<string, unknown>>;

/**
 * A predicate of a plan as a query of the DSL, in filter context: no score. A test never holds on
 * a missing field, `isNull` apart, and a negated test holds where the field has a value and the
 * comparison fails, as `holds` of the kernel says.
 */
export function predicateToQuery(predicate: Predicate, fields: DocumentMapper<unknown>): Query {
  if (predicate.kind === 'test') {
    return testToQuery(predicate, fields);
  }

  const parts = predicate.parts.map((part) => predicateToQuery(part, fields));

  return predicate.kind === 'and' ? { bool: { filter: parts } } : { bool: { should: parts, minimum_should_match: 1 } };
}

function testToQuery(test: PredicateTest, fields: DocumentMapper<unknown>): Query {
  const path = fields.pathOf(test.field);
  const exists = { exists: { field: path } };

  if (test.operator === 'isNull') {
    return test.value === true ? { bool: { must_not: [exists] } } : exists;
  }

  const operands = (Array.isArray(test.value) ? test.value : [test.value]).map((value: FieldValue) =>
    fields.operandOf(test.field, value),
  );

  const compared = comparison(test.operator, path, operands);
  const failing = test.operator === 'ne' ? !test.negated : test.negated;

  return failing ? { bool: { filter: [exists], must_not: [compared] } } : compared;
}

function comparison(operator: PredicateTest['operator'], path: string, operands: readonly unknown[]): Query {
  const [first, second] = operands;

  switch (operator) {
    case 'in':
      return { terms: { [path]: operands } };
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return { range: { [path]: { [operator]: first } } };
    case 'between':
      return { range: { [path]: { gte: first, lte: second } } };
    case 'contains':
      return { wildcard: { [path]: { value: `*${escaped(String(first))}*` } } };
    case 'startsWith':
      return { prefix: { [path]: { value: String(first) } } };
    default:
      return { term: { [path]: first } };
  }
}

/** The text of a `contains` as a wildcard pattern: its `*`, `?` and `\` match themselves. */
function escaped(text: string): string {
  return text.replace(/[\\*?]/g, (character) => `\\${character}`);
}
