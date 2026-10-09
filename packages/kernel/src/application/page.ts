import { DomainError } from '../domain/domain-error.js';

export type SortDirection = 'asc' | 'desc';

/** `Field` is the closed list of what a read port can sort by; it differs for each port. */
export interface Sort<Field extends string = string> {
  readonly field: Field;
  readonly direction: SortDirection;
}

export interface OffsetPageRequest<Field extends string = string> {
  readonly kind: 'offset';
  readonly offset: number;
  readonly limit: number;
  readonly sort: readonly Sort<Field>[];
}

export interface CursorPageRequest<Field extends string = string> {
  readonly kind: 'cursor';
  /** Opaque: the `nextCursor` of the previous page, absent for the first one. */
  readonly cursor?: string;
  readonly limit: number;
  readonly sort: readonly Sort<Field>[];
}

/** What every list query carries. Build one with `offsetPage` or `cursorPage`: they validate. */
export type PageRequest<Field extends string = string> =
  | OffsetPageRequest<Field>
  | CursorPageRequest<Field>;

/** What every list answers. `total` when it is cheap to count, `nextCursor` when more follow. */
export interface Page<T> {
  readonly items: readonly T[];
  readonly total?: number;
  readonly nextCursor?: string;
}

export interface PageLimits {
  readonly defaultSize: number;
  readonly maxSize: number;
}

export const DEFAULT_PAGE_LIMITS: PageLimits = Object.freeze({ defaultSize: 20, maxSize: 100 });

export const INVALID_PAGE_REQUEST = 'INVALID_PAGE_REQUEST';

export class InvalidPageRequestError extends DomainError {
  readonly code = INVALID_PAGE_REQUEST;
}

export interface OffsetPageInput<Field extends string = string> {
  readonly offset?: number;
  readonly limit?: number;
  readonly sort?: readonly Sort<Field>[];
}

export function offsetPage<Field extends string = string>(
  input: OffsetPageInput<Field> = {},
  limits: PageLimits = DEFAULT_PAGE_LIMITS,
): OffsetPageRequest<Field> {
  const offset = input.offset ?? 0;
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new InvalidPageRequestError('The offset of a page is a non-negative integer');
  }
  return { kind: 'offset', offset, limit: sizeWithin(input.limit, limits), sort: input.sort ?? [] };
}

export interface CursorPageInput<Field extends string = string> {
  readonly cursor?: string;
  readonly limit?: number;
  readonly sort?: readonly Sort<Field>[];
}

export function cursorPage<Field extends string = string>(
  input: CursorPageInput<Field> = {},
  limits: PageLimits = DEFAULT_PAGE_LIMITS,
): CursorPageRequest<Field> {
  if (input.cursor === '') {
    throw new InvalidPageRequestError('The cursor of a page is not empty');
  }
  return {
    kind: 'cursor',
    ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
    limit: sizeWithin(input.limit, limits),
    sort: input.sort ?? [],
  };
}

function sizeWithin(limit: number | undefined, limits: PageLimits): number {
  const size = limit ?? limits.defaultSize;
  if (!Number.isSafeInteger(size) || size < 1 || size > limits.maxSize) {
    throw new InvalidPageRequestError(
      `The size of a page is an integer between 1 and ${String(limits.maxSize)}`,
    );
  }
  return size;
}

export function pageOf<T>(items: readonly T[], more: Omit<Page<T>, 'items'> = {}): Page<T> {
  return { items, ...more };
}

export function mapPage<T, U>(page: Page<T>, map: (item: T) => U): Page<U> {
  const { items, ...more } = page;
  return { items: items.map(map), ...more };
}

/** Where a cursor page ended: the sort values of its last item, tie-breaker included. */
export type CursorPosition = Readonly<Record<string, string | number | boolean | null>>;

/**
 * The opaque `nextCursor` of a position. Opaque means that a client sends it back untouched;
 * it is not a secret and not signed, so the reader validates what `decodeCursor` gives.
 */
export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(JSON.stringify(position), 'utf8').toString('base64url');
}

/** The position a cursor stands for. A cursor this function did not write is refused. */
export function decodeCursor(cursor: string): CursorPosition {
  const position = parsedPosition(cursor);
  if (!isCursorPosition(position)) {
    throw new InvalidPageRequestError('The cursor of a page is the nextCursor of a previous page');
  }
  return position;
}

function parsedPosition(cursor: string): unknown {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
}

function isCursorPosition(value: unknown): value is CursorPosition {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(
    (part) => part === null || ['string', 'number', 'boolean'].includes(typeof part),
  );
}
