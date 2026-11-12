import fs from 'node:fs';
import path from 'node:path';
import { isWorkingMigration } from '../check/migrations/is-working-migration';
import type { Migration } from '../check/migrations/migration-folder';
import { readMigrationFolder } from '../check/migrations/read-migration-folder';
import { runGit } from '../commit/run-git';
import { mentionedTables } from './mentioned-tables';
import { migrationsAt } from './migrations-at';
import { nextMigrationNumber } from './next-migration-number';
import { appliedUnderOldName } from './order/applied-under-old-name';
import { hasMigrationName } from './order/has-migration-name';

/** The migrations of a knex, Prisma or TypeORM project to land on the trunk. */
export interface Renumbering {
  readonly root: string;
  readonly orm: 'knex' | 'prisma' | 'typeorm';
  /**
   * The base of the merge and the commit of the trunk. With the trunk as the base (a branch that
   * already holds it), what the trunk gained is what sorts after the first migration to land, and
   * only the migrations that do not follow the trunk's already are renamed.
   */
  readonly base: string;
  readonly trunk: string;
  readonly now: Date;
  /** Says what would be renamed, and renames nothing. */
  readonly dryRun?: boolean;
}

/** What renaming did, or why it stopped. */
export interface MigrationsLanded {
  readonly lines: readonly string[];
  readonly stop?: string;
}

/** A migration of the branch and the number it lands under. */
interface Move {
  readonly migration: Migration;
  readonly number: string;
}

const NUMBERED = /^(\d+)([_-])(?:working[_-])?(.*)$/;
const EPOCH = new Date(0);

/**
 * Lands the migrations of the branch the trunk does not have: each gets a number after the last
 * of the trunk and loses its `working-` prefix, its content kept (TypeORM: the class and its
 * `name` follow). On a branch that already holds the trunk, a migration that follows the last of
 * the trunk already keeps its name, and the others keep their order around it. When a migration
 * the trunk gained since the base changes a table one of the renamed changes too, their order is
 * a decision: the landing stops, the migration is to generate again on the trunk.
 */
export function renumberMigrations(renumbering: Renumbering): MigrationsLanded {
  const { root, orm, base, trunk } = renumbering;
  const folder = readMigrationFolder(root, orm);
  const where = { folder: folder?.folder ?? 'migrations', directories: orm === 'prisma' };
  const onTrunk = migrationsAt(root, trunk, where).filter(({ name }) => hasMigrationName(name));

  const branch = (folder?.migrations ?? []).filter(
    ({ name }) => hasMigrationName(name) && !onTrunk.some((landed) => landed.name === name),
  );

  const moves = movesOf(renumbering, { branch, last: lastNumber(onTrunk, orm) });
  const before = new Set(migrationsAt(root, base, where).map((migration) => migration.name));
  const first = moves[0]?.migration.name ?? '';
  const gained = onTrunk.filter((migration) => (base === trunk ? migration.name > first : !before.has(migration.name)));
  const overlap = overlapOf(renumbering, { moving: moves.map(({ migration }) => migration), gained });

  if (overlap !== undefined) {
    return { lines: [], stop: overlap };
  }

  return {
    lines: moves.length === 0 ? [] : [...moves.map((move) => moved(renumbering, move)), appliedUnderOldName(orm)],
  };
}

/** The number of the last migration of the trunk; zeros, in the format of the tool, without one. */
function lastNumber(onTrunk: readonly Migration[], orm: Renumbering['orm']): string {
  return NUMBERED.exec(onTrunk.at(-1)?.name ?? '')?.[1] ?? '0'.repeat(orm === 'typeorm' ? 13 : 14);
}

/**
 * The migrations to rename, in their order, each with its number. In a merge, all of them, not
 * before now. Without one, those that do not follow what comes before them: the last of the
 * trunk, then each migration of the branch in turn. A migration that keeps its name bounds the
 * numbers before it, so those count up from the last of the trunk; with none after them they are
 * numbered from now, as in a merge.
 */
function movesOf(
  { base, trunk, now }: Renumbering,
  { branch, last }: { branch: readonly Migration[]; last: string },
): Move[] {
  if (base !== trunk) {
    return numbered(branch, { last, now, isMoving: () => true });
  }

  const isMoving = (migration: Migration, previous: string): boolean =>
    isWorkingMigration(migration.name) || !isAfter(numberOf(migration), previous);

  const counted = numbered(branch, { last, now: EPOCH, isMoving });
  const moving = new Set(counted.map((move) => move.migration));
  const firstMoved = branch.findIndex((migration) => moving.has(migration));
  const bounded = branch.some((migration, index) => index > firstMoved && !moving.has(migration));

  return bounded ? counted : numbered(branch, { last, now, isMoving });
}

/** Walks the migrations in their order: one that moves takes the number after the one before it. */
function numbered(
  branch: readonly Migration[],
  { last, now, isMoving }: { last: string; now: Date; isMoving: (migration: Migration, previous: string) => boolean },
): Move[] {
  const moves: Move[] = [];
  let previous = last;

  for (const migration of branch) {
    if (isMoving(migration, previous)) {
      previous = nextMigrationNumber(previous, now);
      moves.push({ migration, number: previous });
    } else {
      previous = numberOf(migration);
    }
  }

  return moves;
}

function numberOf(migration: Migration): string {
  return NUMBERED.exec(migration.name)?.[1] ?? '';
}

/** Numbers of one format have one length; a longer one is a later one. */
function isAfter(number: string, previous: string): boolean {
  return number.length === previous.length ? number > previous : number.length > previous.length;
}

function moved({ root, dryRun }: Renumbering, { migration, number }: Move): string {
  if (dryRun === true) {
    return `${migration.name} would be renamed with a number after the last migration of the trunk`;
  }

  return `${migration.name} renamed ${renamedMigration(root, migration, number)}, after the last migration of the trunk`;
}

function overlapOf(
  { root, orm, trunk }: Renumbering,
  { moving, gained }: { moving: readonly Migration[]; gained: readonly Migration[] },
): string | undefined {
  // `./`: from the project root, which is not the top of the repository when the project sits in a folder of it.
  const theirs = new Set(
    gained.flatMap((migration) => [...mentionedTables(runGit(root, ['show', `${trunk}:./${migration.file}`]) ?? '')]),
  );

  for (const migration of moving) {
    const shared = [...mentionedTables(readIfPresent(path.join(root, migration.file)))].filter((table) =>
      theirs.has(table),
    );

    if (shared.length > 0) {
      return `${migration.name} changes ${shared.join(', ')}, which a migration the trunk gained since the base changes too (${gained.map((other) => other.name).join(', ')}): their order is a decision. ${generateAgain(orm, migration)}`;
    }
  }

  return undefined;
}

/**
 * How the migration is generated again after the trunk's: its name is taken until the old one is
 * deleted, which `db:generate` refuses, so the deletion comes first.
 */
function generateAgain(orm: Renumbering['orm'], migration: Migration): string {
  const what = NUMBERED.exec(migration.name)?.[3] ?? migration.name;
  const old = orm === 'prisma' ? `the folder ${path.posix.dirname(migration.file)}/` : migration.file;
  const named = orm === 'typeorm' ? `migrations/${what}` : what;

  return `Generate it again on the trunk: delete ${old} (\`git show HEAD:${migration.file}\` keeps what was written by hand), then \`npm run db:generate ${named}\`, which refuses the name while the old migration is there.`;
}

/** Renames one migration with `number`, answering its new name. */
function renamedMigration(root: string, migration: Migration, number: string): string {
  const name = renamedName(migration, number);

  const isDirectory =
    migration.file.endsWith('/migration.sql') && path.posix.basename(migration.file) === 'migration.sql';

  const from = path.join(root, isDirectory ? path.posix.dirname(migration.file) : migration.file);
  const to = path.join(path.dirname(from), `${name}${isDirectory ? '' : path.extname(from)}`);

  fs.renameSync(from, to);

  if (!isDirectory) {
    renameClass(to, { old: numberOf(migration), number });
  }

  return name;
}

function renamedName(migration: Migration, number: string): string {
  const [, , separator = '_', what = migration.name] = NUMBERED.exec(migration.name) ?? [];

  return `${number}${separator}${what}`;
}

/**
 * TypeORM names the class of a migration after it, number included, and repeats it in `name`:
 * the declaration and that property follow, and nothing else that holds the same letters (a
 * statement of SQL, a helper named after the class).
 */
function renameClass(file: string, { old, number }: { old: string; number: string }): void {
  const text = fs.readFileSync(file, 'utf8');
  const named = new RegExp(String.raw`\bclass\s+(\w*${old})\b`).exec(text)?.[1];

  if (named !== undefined) {
    const renamed = named.replace(/^Working(?=[A-Z])/, '').replace(old, number);
    const declared = new RegExp(String.raw`\b(class\s+)${named}\b`);
    const property = new RegExp(String.raw`\b(name\s*=\s*['"\x60])${named}(?=['"\x60])`);

    fs.writeFileSync(
      file,
      text
        .replace(declared, (_, keyword: string) => `${keyword}${renamed}`)
        .replace(property, (_, assigned: string) => `${assigned}${renamed}`),
    );
  }
}

function readIfPresent(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}
