import { LIVE_ROWS_CONSTRAINT_FORM } from './live-rows-constraint-form';

const FORM = new RegExp(LIVE_ROWS_CONSTRAINT_FORM);

/** A name as PostgreSQL prints it in a definition: quoted, or plain in lower case; its keywords are in upper case. */
const NAMES = /"(?:[^"]|"")+"|[a-z_][a-z0-9_]*/g;

/**
 * The columns a check constraint keeps whole in the live rows, when it is written as the kit
 * writes it with this column as the mark of a deleted row; `undefined` for any other check, one
 * that only looks like it included (`(deleted OR title IS NOT NULL) AND ..`, `NOT (..)`).
 */
export function liveRowsColumnsOf(definition: string, deleted: string): string[] | undefined {
  if (!FORM.test(definition)) {
    return undefined;
  }

  const [marked, ...columns] = [...definition.matchAll(NAMES)].map(([name]) => unquoted(name));

  return marked === deleted ? columns : undefined;
}

function unquoted(name: string): string {
  return name.startsWith('"') ? name.slice(1, -1).replaceAll('""', '"') : name;
}
