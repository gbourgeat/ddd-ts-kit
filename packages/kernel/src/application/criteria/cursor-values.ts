import type { FieldValue } from './field-value';

/** The values of the sort fields of the last row of a page, as the criteria compares them. */
export type CursorValues = Readonly<Record<string, FieldValue | null>>;
