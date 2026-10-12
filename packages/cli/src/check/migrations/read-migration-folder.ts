import fs from 'node:fs';
import path from 'node:path';
import type { OrmStack } from '../../config/index.js';
import { drizzleOutFolder } from './drizzle-out-folder.js';
import type { Migration, MigrationFolder } from './migration-folder.js';

const SCRIPTS = ['.js', '.ts', '.mjs', '.cjs'];

/** Where the migration tool of a generated project writes its migrations; undefined without one. */
export function readMigrationFolder(root: string, orm: OrmStack): MigrationFolder | undefined {
  if (orm === 'drizzle') {
    return filesIn(root, drizzleOutFolder(root), ['.sql']);
  }

  if (orm === 'knex' || orm === 'typeorm') {
    return filesIn(root, 'migrations', SCRIPTS);
  }

  return orm === 'prisma' ? directoriesIn(root, 'prisma/migrations') : undefined;
}

function filesIn(root: string, folder: string, extensions: readonly string[]): MigrationFolder {
  const migrations = entriesOf(path.join(root, folder))
    .filter((entry) => entry.isFile() && extensions.includes(path.extname(entry.name)) && !entry.name.endsWith('.d.ts'))
    .map((entry) => ({ name: entry.name.slice(0, -path.extname(entry.name).length), file: `${folder}/${entry.name}` }));

  return { folder, migrations: byName(migrations) };
}

function directoriesIn(root: string, folder: string): MigrationFolder {
  const migrations = entriesOf(path.join(root, folder))
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, file: `${folder}/${entry.name}/migration.sql` }));

  return { folder, migrations: byName(migrations) };
}

function byName(migrations: Migration[]): Migration[] {
  return migrations.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
}

function entriesOf(directory: string): fs.Dirent[] {
  try {
    return fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}
