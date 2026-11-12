import { isWorkingMigration } from '../check/migrations/is-working-migration';
import { readMigrationFolder } from '../check/migrations/read-migration-folder';
import type { OrmStack } from '../config';
import { replayedOn } from './land-drizzle';
import type { MergeContext } from './merge-context';
import type { MergeReport } from './merge-report';
import { NEXT_STEPS } from './next-steps';
import { migrationOrder } from './order/migration-order';
import { renumberMigrations } from './renumber-migrations';

/**
 * `--to-land` on a branch that already holds the trunk (merged by `git merge`, or by `merge-trunk`
 * without `--to-land`): there is no merge to make, and its migrations still have to follow the
 * trunk's. When one sorts before the last of the trunk, is out of the journal of drizzle-kit, or
 * is a working one, they are landed as a merge lands them (replayed under drizzle-kit, renamed
 * elsewhere) and left to commit: no merge commit carries them.
 */
export function landUpToDate(context: MergeContext, report: MergeReport, now: Date): MergeReport {
  const orm = context.config?.stack.orm;
  const trunk = { name: report.trunk.ref, commit: report.trunk.commit };

  if (!isMigrated(orm) || !hasMigrationsToLand(context.root, orm, trunk)) {
    return report;
  }

  const landed =
    orm === 'drizzle'
      ? replayedOn(context.root, { trunk: trunk.commit, toLand: true })
      : renumberMigrations({ root: context.root, orm, base: trunk.commit, trunk: trunk.commit, now });

  const migrations = [...report.migrations, ...landed.lines];

  if (landed.stop !== undefined) {
    return { ...report, status: 'stopped', migrations, stop: landed.stop, next: NEXT_STEPS.migrationsUpToDate };
  }

  return landed.lines.length === 0 ? report : { ...report, migrations, next: NEXT_STEPS.landedUpToDate };
}

function hasMigrationsToLand(root: string, orm: OrmStack, trunk: { name: string; commit: string }): boolean {
  const working = (readMigrationFolder(root, orm)?.migrations ?? []).some(({ name }) => isWorkingMigration(name));

  return working || migrationOrder(root, trunk).length > 0;
}

/** The ORM whose migrations the kit generates and orders. */
function isMigrated(orm: OrmStack | undefined): orm is 'drizzle' | 'knex' | 'prisma' | 'typeorm' {
  return orm === 'drizzle' || orm === 'knex' || orm === 'prisma' || orm === 'typeorm';
}
