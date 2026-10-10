import type { CriteriaDefinition, FilterNode } from '@ddd-ts-kit/kernel';
import type { ValidationIssue } from '@ddd-ts-kit/validation';
import type { FilterEntry } from './filter-entry.js';
import { parseCondition } from './parse-condition.js';

const GROUPS = ['and', 'or', 'not'] as const;
const INDEX = /^\d+$/;

interface Reading<Row> {
  readonly definition: CriteriaDefinition<Row>;
  readonly issues: ValidationIssue[];
}

/**
 * The filters the `filter[...]` parameters of a query write, in the order they come. What
 * cannot be read is added to `issues` under `filter.<field>`; whether the read port accepts
 * what was read is for `validateCriteria` to say.
 */
export function parseFilters<Row>(entries: readonly FilterEntry[], reading: Reading<Row>): FilterNode[] {
  const heads = [...new Set(entries.map(({ path }) => path[0] ?? ''))];

  return heads.flatMap((head) => {
    const under = entries.filter(({ path }) => (path[0] ?? '') === head).map(({ path, values }) => ({ path: path.slice(1), values }));
    const group = GROUPS.find((kind) => kind === head);

    if (group !== undefined) return [{ kind: group, filters: parseFilters(under, reading) }];

    if (INDEX.test(head)) return member(parseFilters(under, reading));

    return under.flatMap((entry) => conditions(head, entry, reading));
  });
}

/** The filters written under one index of a group: one filter, or all of them together. */
function member(filters: FilterNode[]): FilterNode[] {
  return filters.length === 1 ? filters : [{ kind: 'and', filters }];
}

function conditions<Row>(field: string, { path, values }: FilterEntry, { definition, issues }: Reading<Row>): FilterNode[] {
  const declared = Object.hasOwn(definition.fields, field) ? definition.fields[field] : undefined;

  const texts = values.filter((value) => typeof value === 'string');

  if (field === '' || path.length > 0 || texts.length !== values.length) {
    issues.push({ path: field === '' ? 'filter' : `filter.${field}`, code: 'invalid_filter', message: 'A filter is written filter[<field>]=<operator>:<value>.' });

    return [];
  }

  // Left for the read port to refuse: it answers the same `unknown_field` whoever built the criteria.
  if (declared === undefined) return [{ kind: 'condition', field, operator: 'eq', value: '' }];

  return texts.flatMap((text) => {
    const condition = parseCondition(field, declared, text);

    if (condition === undefined) issues.push({ path: `filter.${field}`, code: 'invalid_value', message: `Must read as a ${declared.type}.` });

    return condition ?? [];
  });
}
