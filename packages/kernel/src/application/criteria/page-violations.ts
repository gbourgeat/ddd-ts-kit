import type { PageRequest } from '../pagination/page-request';
import type { Sort } from '../pagination/sort';
import type { CriteriaDefinition } from './criteria-definition';
import type { CriteriaViolation } from './criteria-violation';
import { readCursor } from './read-cursor';
import { totalSort } from './total-sort';

interface Asked {
  readonly sort: readonly Sort[];
  readonly page: PageRequest | undefined;
}

export function pageViolations<Row>(definition: CriteriaDefinition<Row>, { sort, page }: Asked): CriteriaViolation[] {
  const violations = sort.flatMap((asked) => sortViolations(definition, asked));

  if (page === undefined) {
    return violations;
  }

  if (page.limit > definition.limits.maxPageSize) {
    violations.push({
      path: 'page.limit',
      code: 'page_too_large',
      message: `A page holds ${String(definition.limits.maxPageSize)} items at most.`,
    });
  }

  if (violations.length === 0 && page.kind === 'cursor' && page.cursor !== undefined) {
    violations.push(...cursorViolations(definition, sort, page.cursor));
  }

  return violations;
}

function sortViolations<Row>(definition: CriteriaDefinition<Row>, { field }: Sort): CriteriaViolation[] {
  const sortable =
    field === definition.tieBreaker ||
    (Object.hasOwn(definition.fields, field) && definition.fields[field]?.sortable === true);

  return sortable
    ? []
    : [{ path: 'sort', code: 'unsortable_field', message: 'This read cannot be sorted by one of the fields asked.' }];
}

function cursorViolations<Row>(
  definition: CriteriaDefinition<Row>,
  sort: readonly Sort[],
  cursor: string,
): CriteriaViolation[] {
  const values = readCursor(cursor, totalSort(definition, sort), definition.fields);

  return values === undefined
    ? [
        {
          path: 'page.cursor',
          code: 'invalid_cursor',
          message: 'The cursor is the nextCursor of a previous page of the same read.',
        },
      ]
    : [];
}
