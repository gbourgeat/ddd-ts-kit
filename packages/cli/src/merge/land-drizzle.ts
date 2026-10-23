import { drizzleOutFolder } from '../check/migrations/drizzle-out-folder';
import { readMigrationFolder } from '../check/migrations/read-migration-folder';
import { CliError } from '../cli-error';
import { replayDrizzleMigrations } from '../migration';
import { migrationsAt } from './migrations-at';
import type { MigrationsLanded } from './renumber-migrations';

/** The commits a drizzle replay of a merge is decided on. */
export interface DrizzleLanding {
  readonly base: string;
  readonly ours: string;
  readonly trunk: string;
  readonly toLand: boolean;
}

const WORKING = /^\d+[_-]working[_-]/;

/**
 * Generates the migrations of the branch again on top of the trunk's when both sides added some
 * since the base (drizzle-kit chains each snapshot to the one before), or when the branch lands
 * with a working migration: then they get their real names. A refusal of the replay stops the merge.
 */
export function landDrizzle(root: string, landing: DrizzleLanding): MigrationsLanded {
  const where = { folder: drizzleOutFolder(root), directories: false };

  const names = (commit: string): Set<string> =>
    new Set(migrationsAt(root, commit, where).map((migration) => migration.name));

  const [base, ours, trunk] = [names(landing.base), names(landing.ours), names(landing.trunk)];
  const added = (side: ReadonlySet<string>): boolean => [...side].some((name) => !base.has(name));

  const working = (readMigrationFolder(root, 'drizzle')?.migrations ?? []).some(
    (migration) => !trunk.has(migration.name) && WORKING.test(migration.name),
  );

  if (!(added(ours) && added(trunk)) && !(landing.toLand && working)) {
    return { lines: [] };
  }

  const lines: string[] = [];
  const io = { out: (text: string) => lines.push(text), err: (text: string) => lines.push(text) };

  try {
    const code = replayDrizzleMigrations({ root, base: landing.trunk, interactive: false, final: landing.toLand }, io);

    return code === 0 ? { lines } : { lines, stop: 'the drizzle replay failed: read its output above' };
  } catch (error) {
    if (error instanceof CliError) {
      return { lines, stop: `the drizzle replay refused: ${error.message} ${error.fix}` };
    }

    throw error;
  }
}
