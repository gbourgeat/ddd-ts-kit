import { listOf } from '../../replies/list-of.js';
import type { Entry } from './entry.js';

/** The reply of `XRANGE` and `XCLAIM`. An entry deleted from its stream comes back empty and is left out. */
export function entriesOf(reply: unknown): Entry[] {
  return listOf(reply).flatMap((answer) => {
    const [id, fields] = listOf(answer);

    return typeof id === 'string' && Array.isArray(fields) ? [{ id, fields: fieldMapOf(fields) }] : [];
  });
}

function fieldMapOf(flat: readonly unknown[]): Map<string, string> {
  const fields = new Map<string, string>();

  for (let index = 0; index + 1 < flat.length; index += 2) {
    fields.set(String(flat[index]), String(flat[index + 1]));
  }

  return fields;
}
