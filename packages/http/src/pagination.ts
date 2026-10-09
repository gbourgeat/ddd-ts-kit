import {
  DEFAULT_PAGE_LIMITS,
  cursorPage,
  err,
  offsetPage,
  ok,
  type Page,
  type PageLimits,
  type PageRequest,
  type Result,
  type Sort,
} from '@ddd-ts-kit/kernel';
import {
  ValidationError,
  customSchema,
  type JsonSchema,
  type Schema,
  type ValidationIssue,
} from '@ddd-ts-kit/validation';

export interface PageQueryOptions<Field extends string = never> extends Partial<PageLimits> {
  /** The closed list of fields a client may sort by. Without it, a `sort` parameter is refused. */
  readonly sortable?: readonly Field[];
  /** The variant of a query that names neither `offset` nor `cursor`. Default `offset`. */
  readonly kind?: PageRequest['kind'];
}

/** A page as a JSON body: the kernel `Page`, with a mutable list as schemas infer it. */
export interface PageBody<T> {
  items: T[];
  total?: number;
  nextCursor?: string;
}

/**
 * Reads `limit`, `offset`, `cursor` and `sort` (`placedAt,-total`: a leading `-` is
 * descending) from a query, as strings or already coerced. Throws the `ValidationError` of the
 * pipeline, so a wrong parameter is answered 422 with one issue per parameter.
 */
export function pageRequestFrom<Field extends string = never>(
  query: unknown,
  options: PageQueryOptions<Field> = {},
): PageRequest<Field> {
  const parsed = parsePageQuery(query, options);
  if (parsed.ok) return parsed.value;
  const issues = parsed.error.map((issue) => ({ ...issue, path: `query.${issue.path}` }));
  throw new ValidationError(issues, 'The request is not valid.');
}

/** The same reading as a `Schema`, for a route whose whole query is the page: `request: { query }`. */
export function pageQuerySchema<Field extends string = never>(
  options: PageQueryOptions<Field> = {},
): Schema<PageRequest<Field>> {
  return customSchema((query) => parsePageQuery(query, options), pageRequestParameters(options));
}

/**
 * The query parameters of a page as a JSON Schema object: one OpenAPI parameter per property
 * once it is the `toJsonSchema()` of a query schema. Merge `properties` into a wider schema
 * when the route has filters too.
 */
export function pageRequestParameters(options: PageQueryOptions<string> = {}): JsonSchema {
  const { defaultSize, maxSize } = limitsOf(options);
  const sortable = options.sortable ?? [];
  return {
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: maxSize, default: defaultSize, description: 'Size of the page.' },
      offset: { type: 'integer', minimum: 0, description: 'Items to skip. Not with `cursor`.' },
      cursor: { type: 'string', minLength: 1, description: 'The `nextCursor` of the previous page. Not with `offset`.' },
      ...(sortable.length === 0 ? {} : { sort: sortParameter(sortable) }),
    },
  };
}

/** The body of a list answer: the items through `map`, `total` and `nextCursor` when the page has them. */
export function pageResponse<T, U>(page: Page<T>, map: (item: T) => U): PageBody<U> {
  return {
    items: page.items.map(map),
    ...(page.total === undefined ? {} : { total: page.total }),
    ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
  };
}

/**
 * The schema of a page of items, from the schema of one item: validates the envelope and each
 * item, and describes both in the contract. Local `$defs` of the item schema move to the top,
 * where the OpenAPI generator collects them.
 */
export function pageSchemaOf<T>(item: Schema<T>): Schema<PageBody<T>> {
  return customSchema((input) => parsePageBody(input, item), pageJsonSchema(item.toJsonSchema()));
}

type Query = Readonly<Record<string, unknown>>;

interface Reading {
  readonly query: Query;
  readonly issues: ValidationIssue[];
}

function parsePageQuery<Field extends string>(
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
  if (reading.issues.length > 0) return err(reading.issues);
  return ok(options.kind === 'cursor' ? cursorFirst(asked, limits) : offsetFirst(asked, limits));
}

interface Asked<Field extends string> {
  readonly limit: number;
  readonly offset: number | undefined;
  readonly cursor: string | undefined;
  readonly sort: Sort<Field>[];
}

/** A cursor page unless the query names an offset. */
function cursorFirst<Field extends string>(asked: Asked<Field>, limits: PageLimits): PageRequest<Field> {
  const { limit, sort, offset, cursor } = asked;
  if (offset !== undefined) return offsetPage({ limit, sort, offset }, limits);
  return cursorPage({ limit, sort, ...(cursor === undefined ? {} : { cursor }) }, limits);
}

/** An offset page unless the query names a cursor. */
function offsetFirst<Field extends string>(asked: Asked<Field>, limits: PageLimits): PageRequest<Field> {
  const { limit, sort, offset, cursor } = asked;
  if (cursor !== undefined) return cursorPage({ limit, sort, cursor }, limits);
  return offsetPage({ limit, sort, ...(offset === undefined ? {} : { offset }) }, limits);
}

function limitsOf(options: Partial<PageLimits>): PageLimits {
  return {
    defaultSize: options.defaultSize ?? DEFAULT_PAGE_LIMITS.defaultSize,
    maxSize: options.maxSize ?? DEFAULT_PAGE_LIMITS.maxSize,
  };
}

function limitOf({ query, issues }: Reading, limits: PageLimits): number {
  if (query['limit'] === undefined) return limits.defaultSize;
  const limit = integerOf(query['limit']);
  if (limit !== undefined && limit >= 1 && limit <= limits.maxSize) return limit;
  issues.push(issue('limit', 'invalid_limit', `Must be an integer between 1 and ${String(limits.maxSize)}.`));
  return limits.defaultSize;
}

function offsetOf({ query, issues }: Reading): number | undefined {
  if (query['offset'] === undefined) return undefined;
  const offset = integerOf(query['offset']);
  if (offset !== undefined && offset >= 0) return offset;
  issues.push(issue('offset', 'invalid_offset', 'Must be a non-negative integer.'));
  return undefined;
}

function cursorOf({ query, issues }: Reading): string | undefined {
  const cursor = query['cursor'];
  if (cursor === undefined) return undefined;
  if (typeof cursor === 'string' && cursor !== '') return cursor;
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
    if (field !== undefined) return [{ field, direction: descending ? 'desc' : 'asc' }];
    issues.push(issue('sort', 'unsortable_field', `Sortable fields: ${sortable.join(', ') || 'none'}.`));
    return [];
  });
}

/** `sort=a,-b` and a repeated `sort=a&sort=-b` read the same. `undefined` for anything else. */
function sortTermsOf(sort: unknown): string[] | undefined {
  if (sort === undefined) return [];
  const values: readonly unknown[] = Array.isArray(sort) ? sort : [sort];
  if (!values.every((value) => typeof value === 'string')) return undefined;
  return values.flatMap((value) => value.split(',')).map((term) => term.trim()).filter((term) => term !== '');
}

function integerOf(value: unknown): number | undefined {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !/^\d{1,15}$/.test(text)) return undefined;
  return Number(text);
}

function issue(path: string, code: string, message: string): ValidationIssue {
  return { path, code, message };
}

function sortParameter(sortable: readonly string[]): JsonSchema {
  return {
    type: 'string',
    description: `Comma-separated fields, a leading "-" for descending. Sortable: ${sortable.join(', ')}.`,
  };
}

function parsePageBody<T>(input: unknown, item: Schema<T>): Result<PageBody<T>, ValidationIssue[]> {
  if (!isRecord(input) || !Array.isArray(input['items'])) {
    return err([issue('items', 'invalid_page', 'A page has a list of items.')]);
  }
  const issues: ValidationIssue[] = [];
  const items = itemsOf(input['items'], item, issues);
  const more = moreOf(input, issues);
  return issues.length > 0 ? err(issues) : ok({ items, ...more });
}

function moreOf(input: Record<string, unknown>, issues: ValidationIssue[]): Omit<PageBody<never>, 'items'> {
  const { total, nextCursor } = input;
  const counted = typeof total === 'number' && Number.isSafeInteger(total) && total >= 0;
  if (total !== undefined && !counted) {
    issues.push(issue('total', 'invalid_page', 'Must be a non-negative integer.'));
  }
  if (nextCursor !== undefined && typeof nextCursor !== 'string') {
    issues.push(issue('nextCursor', 'invalid_page', 'Must be a string.'));
  }
  return { ...(counted ? { total } : {}), ...(typeof nextCursor === 'string' ? { nextCursor } : {}) };
}

function itemsOf<T>(inputs: readonly unknown[], item: Schema<T>, issues: ValidationIssue[]): T[] {
  return inputs.flatMap((input, index) => {
    const parsed = item.parse(input);
    if (parsed.ok) return [parsed.value];
    for (const found of parsed.error) {
      const path = found.path === '' ? `items.${String(index)}` : `items.${String(index)}.${found.path}`;
      issues.push({ ...found, path });
    }
    return [];
  });
}

function pageJsonSchema(itemSchema: JsonSchema): JsonSchema {
  const { $schema: _dialect, $defs, definitions, ...item } = itemSchema;
  return {
    type: 'object',
    required: ['items'],
    properties: {
      items: { type: 'array', items: item },
      total: { type: 'integer', minimum: 0, description: 'Present when it is cheap to count.' },
      nextCursor: { type: 'string', description: 'Present when more items follow.' },
    },
    ...($defs === undefined ? {} : { $defs }),
    ...(definitions === undefined ? {} : { definitions }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
