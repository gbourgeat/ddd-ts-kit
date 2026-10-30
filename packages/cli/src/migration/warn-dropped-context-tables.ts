import fs from 'node:fs';
import path from 'node:path';
import { drizzleOutFolder } from '../check/migrations/drizzle-out-folder';
import { isRecord } from '../check/support/is-record';
import type { Io } from '../commands/io';
import { readConfig, type Config } from '../config';
import { schemaOfContext } from '../prisma-schema';
import { declaredTables, type DeclaredTable } from './declared-tables';
import { listedInIndex } from './listed-in-index';
import { migrationFiles } from './migration-files';

/** What writes the migrations: the tables each one knows of are read from what it leaves. */
type MigrationTool = 'drizzle-kit' | 'typeorm';

const CREATE_TABLE = /CREATE TABLE (?:IF NOT EXISTS )?"(\w+)"\."(\w+)"/g;

interface ContextTable extends DeclaredTable {
  /** The name of the file that exports it, without its extension. */
  readonly file: string;
}

/**
 * Says, before the tool runs and without changing the exit code, that the migration it is about to
 * write drops tables of a context: the migrations hold them, the context still exports them, and
 * the schema index, which is all the tool reads, does not list them. That is a line lost from the
 * index, not a table removed on purpose, and the rows go with the migration.
 */
export function warnDroppedContextTables(root: string, io: Io, tool: MigrationTool = 'drizzle-kit'): void {
  const { config } = readConfig(root);
  const file = `${config.platformDir}/database/schema.ts`;
  const index = readIfPresent(path.join(root, file));
  const recorded = tool === 'typeorm' ? createdTables(root) : lastSnapshotTables(root);

  for (const context of index === undefined ? [] : Object.keys(config.contexts)) {
    const schema = schemaOfContext(context);

    const dropped = tablesOf(root, config, context)
      .filter(({ table }) => recorded.includes(`${schema}.${table}`))
      .filter((table) => !listedInIndex(index ?? '', table))
      .map(({ table }) => `${schema}.${table}`);

    if (dropped.length > 0) {
      io.err(
        [
          `Warning: the migration about to be written drops the tables of the context ${context} (${dropped.join(', ')}): ${file} no longer names them, so ${tool} reads them as removed and writes DROP TABLE; those rows are gone once it is migrated.`,
          `  Fix: unless they are meant to go, delete the migration this writes, run \`npx ddd-ts-kit init --force\`, which lists the tables of ${context} again, and generate again.`,
        ].join('\n'),
      );
    }
  }
}

/** The tables the files of the persistence of a context export. */
function tablesOf(root: string, config: Config, context: string): ContextTable[] {
  const directory = `${config.contextsDir}/${context}/infrastructure/persistence`;

  return namesIn(path.join(root, directory))
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
    .flatMap((name) =>
      declaredTables(readIfPresent(path.join(root, directory, name)) ?? '').map((table) => ({
        ...table,
        file: name.replace(/\.ts$/, ''),
      })),
    );
}

/** The tables the migrations of TypeORM created, each as `<schema>.<table>`: it keeps no snapshot. */
function createdTables(root: string): string[] {
  const created = [...migrationFiles(root, 'migrations').values()].flatMap((text) => [...text.matchAll(CREATE_TABLE)]);

  return created.map(([, schema = '', table = '']) => `${schema}.${table}`);
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

function namesIn(directory: string): string[] {
  try {
    return fs.readdirSync(directory);
  } catch {
    return [];
  }
}

function readIfPresent(file: string): string | undefined {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
}
