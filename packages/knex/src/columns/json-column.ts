/**
 * A value as the parameter of a `jsonb` column: its JSON text, which PostgreSQL reads as the column's type.
 * `pg` writes a JavaScript array as a PostgreSQL array literal and a string as it is, so a list or a string
 * handed to the column fails with `22P02`; an object passes either way, which hides the case until the first
 * list. A `null` or an absent value is the JSON `null`; leave the column out of the row to store SQL `NULL`.
 */
export function jsonColumn(value: unknown): string {
  return JSON.stringify(value ?? null);
}
