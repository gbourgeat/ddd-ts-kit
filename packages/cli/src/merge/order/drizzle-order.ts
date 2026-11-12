import type { DrizzleMigrations, JournalEntry } from '../../check/migrations/drizzle-migrations';
import { isWorkingMigration } from '../../check/migrations/is-working-migration';
import { journalEntries } from '../../check/migrations/journal-entries';
import { readDrizzleMigrations } from '../../check/migrations/read-drizzle-migrations';
import { runGit } from '../../commit/run-git';
import { migrationsAt } from '../migrations-at';
import { appliedUnderOldName } from './applied-under-old-name';
import type { MigrationOrderFinding } from './migration-order-finding';
import type { TrunkToFollow } from './trunk-to-follow';

/**
 * Under drizzle-kit the order is the journal's: the migrator applies the entries generated after
 * the last one a database applied, by their `when`, and nothing else. An entry of the branch
 * generated before the last entry of the trunk is skipped there without a word, and a file the
 * journal does not list (a merge kept the journal of one side) is never applied anywhere; one the
 * trunk holds as well is not the branch's to list.
 */
export function drizzleOrder(root: string, trunk: TrunkToFollow): MigrationOrderFinding[] {
  const here = readDrizzleMigrations(root);

  if (here === undefined) {
    return [];
  }

  const journal = `./${here.folder}/meta/_journal.json`;
  const theirs = journalEntries(runGit(root, ['show', `${trunk.commit}:${journal}`]) ?? '') ?? [];
  const fix = fixOf(here.folder, trunk);

  const held = new Set(
    migrationsAt(root, trunk.commit, { folder: here.folder, directories: false }).map(({ name }) => name),
  );

  return [...generatedBefore(here, theirs, trunk), ...unlisted(here, held)].map((finding) => ({ ...finding, fix }));
}

function generatedBefore(
  { entries, folder }: DrizzleMigrations,
  theirs: readonly JournalEntry[],
  trunk: TrunkToFollow,
): Omit<MigrationOrderFinding, 'fix'>[] {
  const last = theirs.at(-1);
  const landed = new Set(theirs.map((entry) => entry.tag));

  if (last === undefined) {
    return [];
  }

  return entries
    .filter(({ tag, when }) => !landed.has(tag) && !isWorkingMigration(tag) && when <= last.when)
    .map(({ tag }) => ({
      kind: 'before-trunk',
      migration: tag,
      file: `${folder}/${tag}.sql`,
      trunkLast: last.tag,
      text: `the migration "${tag}" of this branch was generated before "${last.tag}", the last migration of ${trunk.name}: the migrator of drizzle skips it without a word on a database that already applied "${last.tag}"`,
    }));
}

/**
 * A file the trunk holds too is the trunk's to list: every branch would report it, and none could
 * fix it. A working migration is left out here as everywhere: its place is decided when it lands.
 */
function unlisted(
  { entries, files, folder }: DrizzleMigrations,
  held: ReadonlySet<string>,
): Omit<MigrationOrderFinding, 'fix'>[] {
  const listed = new Set(entries.map((entry) => entry.tag));

  return files
    .filter((tag) => !listed.has(tag) && !held.has(tag) && !isWorkingMigration(tag))
    .map((tag) => ({
      kind: 'not-in-journal',
      migration: tag,
      file: `${folder}/${tag}.sql`,
      text: `the migration "${tag}" is not in ${folder}/meta/_journal.json: drizzle-kit migrate never applies it (a merge that keeps the journal of one side loses the entries of the other)`,
    }));
}

/** The merge that replays when the trunk is to bring in; the replay alone, on the journal of the trunk, once it is in. */
function fixOf(folder: string, trunk: TrunkToFollow): string {
  const limit =
    'A branch with more than one migration that changes the schema is refused, with the steps to generate them again one at a time.';

  if (!trunk.merged) {
    return `Run \`npx ddd-ts-kit merge-trunk\`: it brings ${trunk.name} in, takes its journal and its snapshots, and generates the migrations of the branch again after them, under their names. ${limit} ${appliedUnderOldName('drizzle')}`;
  }

  return `Take the journal and the snapshots of the trunk, \`git checkout ${trunk.name} -- ${folder}/meta\`, then run \`npx ddd-ts-kit drizzle-generate --replay --base ${trunk.name}\`: it finds the migrations of the branch by their files and generates them again after the trunk's, under their names. ${limit} ${appliedUnderOldName('drizzle')}`;
}
