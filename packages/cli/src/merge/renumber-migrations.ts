import fs from 'node:fs';
import path from 'node:path';
import type { Migration } from '../check/migrations/migration-folder';
import { readMigrationFolder } from '../check/migrations/read-migration-folder';
import { runGit } from '../commit/run-git';
import { mentionedTables } from './mentioned-tables';
import { migrationsAt } from './migrations-at';
import { nextMigrationNumber } from './next-migration-number';

/** The migrations of a knex, Prisma or TypeORM project to land on the trunk. */
export interface Renumbering {
  readonly root: string;
  readonly orm: 'knex' | 'prisma' | 'typeorm';
  /** The base of the merge and the commit of the trunk. */
  readonly base: string;
  readonly trunk: string;
  readonly now: Date;
}

/** What renaming did, or why it stopped. */
export interface MigrationsLanded {
  readonly lines: readonly string[];
  readonly stop?: string;
}

const NUMBERED = /^(\d+)([_-])(?:working[_-])?(.*)$/;

/**
 * Lands the migrations of the branch the trunk does not have: each gets a number after the last
 * of the trunk and loses its `working-` prefix, its content kept (TypeORM: the class and its
 * `name` follow). When a migration the trunk gained since the base changes a table one of the
 * branch changes too, their order is a decision: the merge stops, the migration is to generate
 * again on the trunk.
 */
export function renumberMigrations(renumbering: Renumbering): MigrationsLanded {
  const { root, orm, base, trunk } = renumbering;
  const folder = readMigrationFolder(root, orm);
  const where = { folder: folder?.folder ?? 'migrations', directories: orm === 'prisma' };
  const onTrunk = migrationsAt(root, trunk, where);

  const branch = (folder?.migrations ?? []).filter(
    (migration) => !onTrunk.some((landed) => landed.name === migration.name),
  );

  const before = new Set(migrationsAt(root, base, where).map((migration) => migration.name));
  const gained = onTrunk.filter((migration) => !before.has(migration.name));
  const overlap = overlapOf(root, { branch, gained, trunk });

  if (overlap !== undefined) {
    return { lines: [], stop: overlap };
  }

  return { lines: renamedAfter(renumbering, { branch, last: lastNumber(onTrunk, orm) }) };
}

/** The number of the last migration of the trunk; zeros, in the format of the tool, without one. */
function lastNumber(onTrunk: readonly Migration[], orm: Renumbering['orm']): string {
  return NUMBERED.exec(onTrunk.at(-1)?.name ?? '')?.[1] ?? '0'.repeat(orm === 'typeorm' ? 13 : 14);
}

/** Renames each migration of the branch, in its order, with a number after `last`. */
function renamedAfter(
  { root, now }: Renumbering,
  { branch, last }: { branch: readonly Migration[]; last: string },
): string[] {
  let previous = last;

  return branch.map((migration) => {
    const renamed = renamedMigration(root, migration, nextMigrationNumber(previous, now));

    previous = NUMBERED.exec(renamed)?.[1] ?? previous;

    return `${migration.name} renamed ${renamed}, after the last migration of the trunk`;
  });
}

function overlapOf(
  root: string,
  { branch, gained, trunk }: { branch: readonly Migration[]; gained: readonly Migration[]; trunk: string },
): string | undefined {
  const theirs = new Set(
    gained.flatMap((migration) => [...mentionedTables(runGit(root, ['show', `${trunk}:${migration.file}`]) ?? '')]),
  );

  for (const migration of branch) {
    const shared = [...mentionedTables(readIfPresent(path.join(root, migration.file)))].filter((table) =>
      theirs.has(table),
    );

    if (shared.length > 0) {
      const what = NUMBERED.exec(migration.name)?.[3] ?? migration.name;

      return `${migration.name} changes ${shared.join(', ')}, which a migration the trunk gained since the base changes too (${gained.map((other) => other.name).join(', ')}): their order is a decision. Regenerate it on the trunk: \`npm run db:generate ${what}\`, after the trunk's.`;
    }
  }

  return undefined;
}

/** Renames one migration with `number`, answering its new name. */
function renamedMigration(root: string, migration: Migration, number: string): string {
  const [, old = '', separator = '_', what = migration.name] = NUMBERED.exec(migration.name) ?? [];
  const name = `${number}${separator}${what}`;

  const isDirectory =
    migration.file.endsWith('/migration.sql') && path.posix.basename(migration.file) === 'migration.sql';

  const from = path.join(root, isDirectory ? path.posix.dirname(migration.file) : migration.file);
  const to = path.join(path.dirname(from), `${name}${isDirectory ? '' : path.extname(from)}`);

  fs.renameSync(from, to);

  if (!isDirectory && old !== '') {
    renameClass(to, { old, number });
  }

  return name;
}

/** TypeORM names the class of a migration after it, number included, and repeats it in `name`. */
function renameClass(file: string, { old, number }: { old: string; number: string }): void {
  const text = fs.readFileSync(file, 'utf8');
  const named = new RegExp(String.raw`\bclass\s+(\w*${old})\b`).exec(text)?.[1];

  if (named !== undefined) {
    const renamed = named.replace(/^Working(?=[A-Z])/, '').replace(old, number);

    fs.writeFileSync(file, text.replaceAll(named, renamed));
  }
}

function readIfPresent(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}
