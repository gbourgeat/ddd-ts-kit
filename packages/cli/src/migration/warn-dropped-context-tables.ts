import fs from 'node:fs';
import path from 'node:path';
import { isRecord } from '../check/support/is-record';
import { drizzleOutFolder } from '../check/migrations/drizzle-out-folder';
import type { Io } from '../commands/io';
import { readConfig } from '../config';
import { schemaOfContext } from '../prisma-schema';
import { migrationFiles } from './migration-files';

/**
 * Says, before drizzle-kit runs and without changing the exit code, that the migration it is about
 * to write drops the tables of a context: the last snapshot holds them, and the schema index,
 * which is all drizzle-kit reads, no longer names the tables file of the context. That is a line
 * lost from the index, not a table removed on purpose, and the data goes with the migration.
 */
export function warnDroppedContextTables(root: string, io: Io): void {
  const { config } = readConfig(root);
  const index = `${config.platformDir}/database/schema.ts`;
  const named = readIfPresent(path.join(root, index));
  const tables = lastSnapshotTables(root);

  for (const context of named === undefined ? [] : Object.keys(config.contexts)) {
    const schema = schemaOfContext(context);
    const dropped = tables.filter((table) => table.startsWith(`${schema}.`));

    if (dropped.length > 0 && named?.includes(`/${context}.schema`) === false) {
      io.err(
        [
          `Warning: the migration about to be written drops the tables of the context ${context} (${dropped.join(', ')}) and its schema: ${index} no longer names them, so drizzle-kit reads them as removed and writes DROP TABLE "${schema}"...; those rows are gone once it is migrated.`,
          `  Fix: unless the tables are meant to go, delete the migration this writes, run \`npx ddd-ts-kit init --force\`, which lists the tables of ${context} again, and generate again.`,
        ].join('\n'),
      );
    }
  }
}

/** The tables of the snapshot of the last migration of the journal, each as `<schema>.<table>`, as drizzle-kit keys them. */
function lastSnapshotTables(root: string): string[] {
  const folder = drizzleOutFolder(root);
  const files = migrationFiles(root, folder);
  const journal = parsed(files.get(`${folder}/meta/_journal.json`));
  const entries = isRecord(journal) && Array.isArray(journal['entries']) ? journal['entries'] : [];
  const last: unknown = entries.at(-1);
  const tag = isRecord(last) ? last['tag'] : undefined;
  const prefix = typeof tag === 'string' ? tag.split('_')[0] : undefined;
  const snapshot = parsed(files.get(`${folder}/meta/${prefix}_snapshot.json`));
  const tables = isRecord(snapshot) ? snapshot['tables'] : undefined;

  return isRecord(tables) ? Object.keys(tables) : [];
}

function parsed(text: string | undefined): unknown {
  try {
    return text === undefined ? undefined : JSON.parse(text);
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
