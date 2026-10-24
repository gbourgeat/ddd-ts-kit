import { ERASED_PERSONAL_DATA } from '../../application/event-sourcing/erased-personal-data';

const TEXT_TYPE = /char|text|citext/i;

/**
 * What a pseudonymised column reads, from the SQL type of the column: `ERASED_PERSONAL_DATA` for
 * a text (`text`, `varchar`, `character varying`, `char`, `citext`), nothing for any other type,
 * since a number, a date or a JSON document cannot carry the marker. The one rule every persistence
 * package follows, so that the same declaration erases the same way on every ORM.
 */
export function pseudonymisedValueOf(sqlType: string): string | null {
  return TEXT_TYPE.test(sqlType) ? ERASED_PERSONAL_DATA : null;
}
