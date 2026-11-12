import { isWorkingMigration } from '../check/migrations/is-working-migration';
import type { Migration } from '../check/migrations/migration-folder';
import { readMigrationFolder } from '../check/migrations/read-migration-folder';
import type { OrmStack } from '../config';
import { replayedOn } from './land-drizzle';
import type { MergeContext } from './merge-context';
import type { MergeReport } from './merge-report';
import { migrationsAt } from './migrations-at';
import { NEXT_STEPS } from './next-steps';
import { appliedUnderOldName } from './order/applied-under-old-name';
import { migrationsOfCommit } from './order/migrations-of-commit';
import { migrationsOfTree } from './order/migrations-of-tree';
import type { NamedOrm } from './order/ordered-migration';
import { migrationOrder } from './order/migration-order';
import { type MigrationsLanded, renumberMigrations } from './renumber-migrations';

type MigratedOrm = 'drizzle' | 'knex' | 'prisma' | 'typeorm';

/** What a landing without a merge is run with. */
interface Landing {
  readonly root: string;
  readonly orm: MigratedOrm;
  /** The commit of the trunk the branch already holds. */
  readonly trunk: string;
  readonly now: Date;
  readonly dryRun: boolean;
}

/**
 * `--to-land` on a branch that already holds the trunk (merged by `git merge`, or by `merge-trunk`
 * without `--to-land`): there is no merge to make, and its migrations still have to follow the
 * trunk's. When one sorts before the last of the trunk, is out of the journal of drizzle-kit, or
 * is a working one, they are landed as a merge lands them (replayed under drizzle-kit, renamed
 * elsewhere) and left to commit: no merge commit carries them. A stop leaves the folder as it was
 * found, so that the same command runs again; a dry run says what would move and moves nothing.
 */
export function landUpToDate(
  context: MergeContext,
  report: MergeReport,
  { now = new Date(), dryRun }: { readonly now?: Date; readonly dryRun: boolean },
): MergeReport {
  const orm = context.config?.stack.orm;
  const trunk = { name: report.trunk.ref, commit: report.trunk.commit };

  if (!isMigrated(orm) || !hasMigrationsToLand(context.root, orm, trunk)) {
    return report;
  }

  const landing = { root: context.root, orm, trunk: trunk.commit, now, dryRun };

  const landed =
    orm === 'drizzle' ? replayed(landing, trunk.name) : renumberMigrations({ ...landing, orm, base: trunk.commit });

  const migrations = [...report.migrations, ...landed.lines];

  if (landed.stop !== undefined) {
    return { ...report, status: 'stopped', migrations, stop: landed.stop, next: NEXT_STEPS.migrationsUpToDate };
  }

  return { ...report, migrations, next: dryRun ? NEXT_STEPS.dryRunUpToDate : NEXT_STEPS.landedUpToDate };
}

function hasMigrationsToLand(root: string, orm: MigratedOrm, trunk: { name: string; commit: string }): boolean {
  return toReplay(root, orm, trunk).length > 0;
}

/** The working migrations of the branch and those that do not follow the trunk's, by name. */
function toReplay(root: string, orm: MigratedOrm, trunk: { name: string; commit: string }): string[] {
  const added = orm === 'drizzle' ? addedUnderDrizzle(root, trunk.commit) : addedBy(root, orm, trunk.commit);

  return [
    ...new Set([
      ...added.map(({ name }) => name).filter(isWorkingMigration),
      ...migrationOrder(root, trunk).map(({ migration }) => migration),
    ]),
  ];
}

function addedBy(root: string, orm: NamedOrm, trunk: string): Migration[] {
  const held = new Set(migrationsOfCommit(root, orm, trunk).map(({ file }) => file));

  return migrationsOfTree(root, orm).filter(({ file }) => !held.has(file));
}

function addedUnderDrizzle(root: string, trunk: string): Migration[] {
  const folder = readMigrationFolder(root, 'drizzle');
  const where = { folder: folder?.folder ?? 'migrations', directories: false };
  const held = new Set(migrationsAt(root, trunk, where).map(({ name }) => name));

  return (folder?.migrations ?? []).filter(({ name }) => !held.has(name));
}

/**
 * The replay of drizzle-kit, which deletes the migrations of the branch before it generates them
 * again: it is asked to put the folder back when it stops in between. A deleted migration left in
 * the tree could only be committed as a deletion, and the command refuses to run again on a
 * changed tree.
 */
function replayed({ root, trunk, dryRun }: Landing, trunkName: string): MigrationsLanded {
  if (dryRun) {
    return {
      lines: toReplay(root, 'drizzle', { name: trunkName, commit: trunk }).map(
        (name) => `${name} would be generated again after the migrations of the trunk`,
      ),
    };
  }

  const landed = replayedOn(root, { trunk, toLand: true, putBack: true });
  const moved = landed.stop === undefined && landed.lines.some((line) => /^(?:Generated|Renamed) /.test(line));

  return moved ? { lines: [...landed.lines, appliedUnderOldName('drizzle')] } : landed;
}

/** The ORM whose migrations the kit generates and orders. */
function isMigrated(orm: OrmStack | undefined): orm is MigratedOrm {
  return orm === 'drizzle' || orm === 'knex' || orm === 'prisma' || orm === 'typeorm';
}
