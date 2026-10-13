import { EVENT_STORE_TABLES } from './event-store-tables.js';

/** A table of the event store, quoted and in its schema when it has one. */
export function qualifiedTable(schema: string | undefined, table: keyof typeof EVENT_STORE_TABLES): string {
  const name = quoted(EVENT_STORE_TABLES[table]);

  return schema === undefined ? name : `${quoted(schema)}.${name}`;
}

function quoted(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
