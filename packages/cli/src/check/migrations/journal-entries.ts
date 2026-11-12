import { isRecord } from '../support/is-record';
import type { JournalEntry } from './drizzle-migrations';

/** The entries of a `meta/_journal.json` of drizzle-kit, in its order; undefined when the text is not a journal. */
export function journalEntries(text: string): JournalEntry[] | undefined {
  const journal = parsed(text);

  return isRecord(journal) && Array.isArray(journal['entries']) ? journal['entries'].filter(isEntry) : undefined;
}

function isEntry(value: unknown): value is JournalEntry {
  return (
    isRecord(value) &&
    typeof value['idx'] === 'number' &&
    typeof value['when'] === 'number' &&
    typeof value['tag'] === 'string'
  );
}

function parsed(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
