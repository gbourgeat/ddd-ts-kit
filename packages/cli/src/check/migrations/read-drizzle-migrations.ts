import fs from 'node:fs';
import path from 'node:path';
import { isRecord } from '../support/is-record';
import type { DrizzleMigrations, JournalEntry, SnapshotLink } from './drizzle-migrations';
import { drizzleOutFolder } from './drizzle-out-folder';

/** The journal, the SQL files and the snapshots of the project; undefined when it has no journal to read. */
export function readDrizzleMigrations(root: string): DrizzleMigrations | undefined {
  const folder = drizzleOutFolder(root);
  const directory = path.join(root, folder);
  const journalText = readIfPresent(path.join(directory, 'meta', '_journal.json'));
  const journal = journalText === undefined ? undefined : parsed(journalText);

  if (journalText === undefined || !isRecord(journal) || !Array.isArray(journal['entries'])) {
    return undefined;
  }

  return {
    folder,
    journalText,
    entries: journal['entries'].filter(isEntry),
    files: namesEndingWith(directory, '.sql'),
    snapshots: snapshotsIn(path.join(directory, 'meta')),
  };
}

function snapshotsIn(meta: string): Map<string, SnapshotLink> {
  const links = namesEndingWith(meta, '_snapshot.json').map((prefix) => {
    const snapshot = parsed(readIfPresent(path.join(meta, `${prefix}_snapshot.json`)) ?? '');

    return [prefix, isRecord(snapshot) ? linkOf(snapshot) : undefined] as const;
  });

  return new Map(links.flatMap(([prefix, link]) => (link === undefined ? [] : [[prefix, link] as const])));
}

function linkOf(snapshot: Record<string, unknown>): SnapshotLink | undefined {
  const { id, prevId } = snapshot;

  return typeof id === 'string' && typeof prevId === 'string' ? { id, prevId } : undefined;
}

function isEntry(value: unknown): value is JournalEntry {
  return (
    isRecord(value) &&
    typeof value['idx'] === 'number' &&
    typeof value['when'] === 'number' &&
    typeof value['tag'] === 'string'
  );
}

function namesEndingWith(directory: string, suffix: string): string[] {
  try {
    return fs
      .readdirSync(directory)
      .filter((name) => name.endsWith(suffix))
      .map((name) => name.slice(0, -suffix.length))
      .sort();
  } catch {
    return [];
  }
}

function parsed(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function readIfPresent(file: string): string | undefined {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
}
