import type { CursorPosition } from '../pagination/cursor-position';
import { cursorPositionOf } from '../pagination/cursor-position-of';
import type { Sort } from '../pagination/sort';
import type { CursorValues } from './cursor-values';
import type { FieldDeclaration } from './field-declaration';
import type { FieldValue } from './field-value';
import { isValueOf } from './is-value-of';

type Fields = Readonly<Record<string, FieldDeclaration>>;

/**
 * What a cursor says of each field of the sort, typed as the field declares. `undefined` for a
 * cursor that was not written for this sort: a cursor comes back from a client, and nothing it
 * holds reaches a store unchecked.
 */
export function readCursor(cursor: string, sort: readonly Sort[], fields: Fields): CursorValues | undefined {
  const position = cursorPositionOf(cursor);

  if (position === undefined || Object.keys(position).length !== sort.length) {
    return undefined;
  }

  const values: Record<string, FieldValue | null> = {};

  for (const { field } of sort) {
    const declared = Object.hasOwn(fields, field) ? fields[field] : undefined;

    const value =
      declared === undefined
        ? undefined
        : valueOf(declared, Object.hasOwn(position, field) ? position[field] : undefined);

    if (value === undefined) {
      return undefined;
    }

    values[field] = value;
  }

  return values;
}

function valueOf(
  declared: FieldDeclaration,
  written: CursorPosition[string] | undefined,
): FieldValue | null | undefined {
  if (written === undefined) {
    return undefined;
  }

  if (written === null) {
    return declared.nullable ? null : undefined;
  }

  const value = declared.type === 'instant' && typeof written === 'string' ? new Date(written) : written;

  return isValueOf(declared.type, value) ? value : undefined;
}
