import {
  cursorPage,
  err,
  offsetPage,
  ok,
  type PageLimits,
  type PageRequest,
  type Result,
  type Sort,
} from '@ddd-ts-kit/kernel';
import type { ValidationIssue } from '@ddd-ts-kit/validation';
import { isRecord } from '../support/is-record.js';
import { issue } from './issue.js';
import { limitsOf } from './limits-of.js';
import type { PageQueryOptions } from './page-query-options.js';

type Query = Readonly<Record<string, unknown>>;

interface Reading {
  readonly query: Query;
  readonly issues: ValidationIssue[];
}

interface Asked<Field extends string> {
  readonly limit: number;
  readonly offset: number | undefined;
  readonly cursor: string | undefined;
  readonly sort: Sort<Field>[];
}

export function parsePageQuery<Field extends string>(
  input: unknown,
  options: PageQueryOptions<Field>,
): Result<PageRequest<Field>, ValidationIssue[]> {
  const reading: Reading = { query: isRecord(input) ? input : {}, issues: [] };
  const limits = limitsOf(options);

  const asked: Asked<Field> = {
    limit: limitOf(reading, limits),
    offset: offsetOf(reading),
    cursor: cursorOf(reading),
    sort: sortOf(reading, options.sortable ?? []),
  };

  if (asked.offset !== undefined && asked.cursor !== undefined) {
    reading.issues.push(issue('cursor', 'offset_with_cursor', 'A page is asked by offset or by cursor, not both.'));
  }

  if (reading.issues.length > 0) {
    return err(reading.issues);
  }

  return ok(options.kind === 'cursor' ? cursorFirst(asked, limits) : offsetFirst(asked, limits));
}

function limitOf({ query, issues }: Reading, limits: PageLimits): number {
  if (query['limit'] === undefined) {
    return limits.defaultSize;
  }

  const limit = integerOf(query['limit']);

  if (limit !== undefined && limit >= 1 && limit <= limits.maxSize) {
    return limit;
  }

  issues.push(issue('limit', 'invalid_limit', `Must be an integer between 1 and ${String(limits.maxSize)}.`));

  return limits.defaultSize;
}

function integerOf(value: unknown): number | undefined {
  const text = typeof value === 'number' ? String(value) : value;

  if (typeof text !== 'string' || !/^\d{1,15}$/.test(text)) {
    return undefined;
  }

  return Number(text);
}

function offsetOf({ query, issues }: Reading): number | undefined {
  if (query['offset'] === undefined) {
    return undefined;
  }

  const offset = integerOf(query['offset']);

  if (offset !== undefined && offset >= 0) {
    return offset;
  }

  issues.push(issue('offset', 'invalid_offset', 'Must be a non-negative integer.'));

  return undefined;
}

function cursorOf({ query, issues }: Reading): string | undefined {
  const cursor = query['cursor'];

  if (cursor === undefined) {
    return undefined;
  }

  if (typeof cursor === 'string' && cursor !== '') {
    return cursor;
  }

  issues.push(issue('cursor', 'invalid_cursor', 'Must be the nextCursor of a previous page.'));

  return undefined;
}

function sortOf<Field extends string>({ query, issues }: Reading, sortable: readonly Field[]): Sort<Field>[] {
  const terms = sortTermsOf(query['sort']);

  if (terms === undefined) {
    issues.push(issue('sort', 'invalid_sort', 'Must be a comma-separated list of fields.'));

    return [];
  }

  return terms.flatMap((term) => {
    const descending = term.startsWith('-');
    const field = sortable.find((allowed) => allowed === (descending ? term.slice(1) : term));

    if (field !== undefined) {
      return [{ field, direction: descending ? 'desc' : 'asc' }];
    }

    issues.push(issue('sort', 'unsortable_field', `Sortable fields: ${sortable.join(', ') || 'none'}.`));

    return [];
  });
}

/** `sort=a,-b` and a repeated `sort=a&sort=-b` read the same. `undefined` for anything else. */
function sortTermsOf(sort: unknown): string[] | undefined {
  if (sort === undefined) {
    return [];
  }

  const values: readonly unknown[] = Array.isArray(sort) ? sort : [sort];

  if (!values.every((value) => typeof value === 'string')) {
    return undefined;
  }

  return values
    .flatMap((value) => value.split(','))
    .map((term) => term.trim())
    .filter((term) => term !== '');
}

/** A cursor page unless the query names an offset. */
function cursorFirst<Field extends string>(asked: Asked<Field>, limits: PageLimits): PageRequest<Field> {
  const { limit, sort, offset, cursor } = asked;

  if (offset !== undefined) {
    return offsetPage({ limit, sort, offset }, limits);
  }

  return cursorPage({ limit, sort, ...(cursor === undefined ? {} : { cursor }) }, limits);
}

/** An offset page unless the query names a cursor. */
function offsetFirst<Field extends string>(asked: Asked<Field>, limits: PageLimits): PageRequest<Field> {
  const { limit, sort, offset, cursor } = asked;

  if (cursor !== undefined) {
    return cursorPage({ limit, sort, cursor }, limits);
  }

  return offsetPage({ limit, sort, ...(offset === undefined ? {} : { offset }) }, limits);
}
