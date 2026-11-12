import fs from 'node:fs';
import path from 'node:path';
import type { Migration } from '../../check/migrations/migration-folder';
import { readMigrationFolder } from '../../check/migrations/read-migration-folder';
import { scan } from '../../check/scan/scan';
import { inOrder } from './in-order';
import type { NamedOrm, OrderedMigration } from './ordered-migration';

const STAMPED_CLASS = /(?<![\w$.])class\s+[A-Za-z_$][\w$]*?(\d{13})(?![\w$])/;

/**
 * What the tool of an ORM takes for a migration in the working tree, in the order it runs them.
 * knex loads every script of the folder, whatever its name. Prisma reads the folders that hold a
 * `migration.sql`. TypeORM takes the classes whose name ends with 13 digits, however the file
 * is named.
 */
export function migrationsOfTree(root: string, orm: NamedOrm): OrderedMigration[] {
  const found = readMigrationFolder(root, orm)?.migrations ?? [];

  if (orm === 'typeorm') {
    return inOrder(
      orm,
      found.flatMap((migration) => stamped(migration, fs.readFileSync(path.join(root, migration.file), 'utf8'))),
    );
  }

  const held = orm === 'prisma' ? found.filter(({ file }) => fs.existsSync(path.join(root, file))) : found;

  return inOrder(
    orm,
    held.map((migration) => ({ ...migration, key: migration.name })),
  );
}

function stamped(migration: Migration, text: string): OrderedMigration[] {
  const stamp = STAMPED_CLASS.exec(scan(text).code)?.[1];

  return stamp === undefined ? [] : [{ ...migration, key: stamp }];
}
