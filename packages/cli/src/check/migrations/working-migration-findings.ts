import type { Finding } from '../model/finding';
import type { Migration } from './migration-folder';

/**
 * What a worker names the migration it generates in its worktree: `working-` right after the
 * number, which every migration tool keeps (Prisma writes it `working_`).
 */
const WORKING = /^\d+[_-]working[_-]/;

/**
 * A working migration lets the branch of a worker run its specs against the tables it changes;
 * it is never merged as is, since the order of the migrations is decided on the trunk.
 */
export function workingMigrationFindings(migrations: readonly Migration[]): (readonly [Migration, Finding])[] {
  return migrations
    .filter((migration) => WORKING.test(migration.name))
    .map((migration) => [migration, working(migration)] as const);
}

function working(migration: Migration): Finding {
  return {
    line: 1,
    message: `The migration "${migration.name}" is a working migration, generated in the worktree of a worker: it is never merged as is.`,
    fix: 'Delete it (under drizzle-kit, with its snapshot and its journal entry) and generate it again on the trunk with `npm run db:generate <what-it-does>`, after the branches merged before it.',
  };
}
