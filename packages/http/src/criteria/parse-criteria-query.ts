import { Criteria, err, ok, validateCriteria, type CriteriaDefinition, type Result } from '@ddd-ts-kit/kernel';
import type { ValidationIssue } from '@ddd-ts-kit/validation';
import { parsePageQuery } from '../pagination/parse-page-query.js';
import { isRecord } from '../support/is-record.js';
import type { CriteriaQueryOptions } from './criteria-query-options.js';
import { filterEntries } from './filter-entries.js';
import { parseFilters } from './parse-filters.js';
import { sortableFields } from './sortable-fields.js';

/** `page.limit` of a criteria is the `limit` parameter of the query, and so on. */
const PARAMETERS: Readonly<Record<string, string>> = { 'page.limit': 'limit', 'page.cursor': 'cursor' };

export function parseCriteriaQuery<Row>(
  input: unknown,
  definition: CriteriaDefinition<Row>,
  options: CriteriaQueryOptions = {},
): Result<Criteria<Row>, ValidationIssue[]> {
  const query = isRecord(input) ? input : {};
  const { defaultPageSize, maxPageSize } = definition.limits;
  const issues: ValidationIssue[] = [];
  const filters = parseFilters(filterEntries(query), { definition, issues });

  const page = parsePageQuery(query, {
    ...options,
    sortable: sortableFields(definition),
    defaultSize: defaultPageSize,
    maxSize: maxPageSize,
  });

  if (!page.ok) {
    return err([...issues, ...page.error]);
  }

  const criteria = Criteria.from<Row>({ filters, page: page.value });

  const refused = validateCriteria(definition, criteria).map(({ path, code, message }) => ({
    path: PARAMETERS[path] ?? path,
    code,
    message,
  }));

  return issues.length + refused.length > 0 ? err([...issues, ...refused]) : ok(criteria);
}
