import type { Sort } from './sort.js';

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
export type PageRequest<Field extends string = string> = OffsetPageRequest<Field> | CursorPageRequest<Field>;
