import { isTextSearch, type FieldValue, type Predicate, type PredicateTest } from '@ddd-ts-kit/kernel';
import type { DocumentMapper } from '../mapping/document.mapper';
import { ignoringCase } from './ignoring-case';

type Query = Readonly<Record<string, unknown>>;

/**
 * The query of each text search. In a wildcard pattern `*`, `?` and `\` of the text match
 * themselves; a search that ignores case is a regular expression that names both forms of each
 * letter, since `case_insensitive` folds the ASCII letters alone.
 */
const SEARCHES = {
  contains: { query: 'wildcard', pattern: (text: string) => `*${text.replace(/[\\*?]/g, '\\$&')}*` },
  startsWith: { query: 'prefix', pattern: (text: string) => text },
  containsIgnoringCase: { query: 'regexp', pattern: (text: string) => `.*${ignoringCase(text)}.*` },
  startsWithIgnoringCase: { query: 'regexp', pattern: (text: string) => `${ignoringCase(text)}.*` },
} as const;

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

  if (isTextSearch(operator)) {
    return { [SEARCHES[operator].query]: { [path]: { value: SEARCHES[operator].pattern(String(first)) } } };
  }

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
    default:
      return { term: { [path]: first } };
  }
}
