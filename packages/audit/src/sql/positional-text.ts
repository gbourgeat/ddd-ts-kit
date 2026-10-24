import type { Sql } from './sql';

/** A statement as PostgreSQL numbers its parameters: `$1`, `$2`... in the order of its values. */
export function positionalText(statement: Sql): string {
  const [first = '', ...rest] = statement.strings;

  return rest.reduce((text, literal, index) => `${text}$${String(index + 1)}${literal}`, first);
}
