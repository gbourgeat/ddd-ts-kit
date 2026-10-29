import fs from 'node:fs';
import path from 'node:path';
import { drizzleHistoryFindings } from '../check/migrations/drizzle-history-findings';
import { drizzleOutFolder } from '../check/migrations/drizzle-out-folder';
import { readDrizzleMigrations } from '../check/migrations/read-drizzle-migrations';
import { CliError } from '../cli-error';
import { knownCommit } from '../commit/known-commit';
import { runGit } from '../commit/run-git';
import type { BranchMigration } from './branch-migration';
import { branchMigrations } from './branch-migrations';
import { migrationFiles } from './migration-files';
import type { ReplayPlan } from './replay-plan';

const CONFLICT_MARKER = /^(?:<{7}|={7}|>{7})(?: |$)/m;

/**
 * The migrations of the branch that `base` does not have, by their `.sql` files, read before
 * anything is deleted, and whether the history forks from the base. Refused, with the fix: a
 * journal that still holds conflict markers, a base that is not a commit, a base with migrations
 * the branch has not merged, and, when the history forks, more than one migration of the branch
 * that changes the schema.
 */
export function planReplay({ root, base }: Pick<ReplayPlan, 'root' | 'base'>): ReplayPlan {
  const folder = drizzleOutFolder(root);

  refuseConflictMarkers(root, `${folder}/meta/_journal.json`, base);

  const commit = knownCommit(
    root,
    base,
    'Fetch it (`git fetch origin`), or name the trunk the branch merged with `--base <ref>`.',
  );

  const onBase = sqlTags(runGit(root, ['ls-tree', '--name-only', commit, '--', `${folder}/`]) ?? '');
  const files = migrationFiles(root, folder);
  const here = sqlTags([...files.keys()].join('\n'));
  const notMerged = onBase.filter((tag) => !here.includes(tag));

  if (notMerged.length > 0) {
    throw new CliError(
      `${base} has migrations this branch does not have: ${notMerged.join(', ')}.`,
      `Merge it first (\`git merge ${base}\`), then run the replay again.`,
    );
  }

  const migrations = branchMigrations({ files, folder, tags: here.filter((tag) => !onBase.includes(tag)) });
  const forked = forks(root);

  if (forked) {
    refuseSeveralSchemaChanges(migrations);
  }

  return { root, base, folder, migrations, forked, found: files };
}

/**
 * Every migration of the base is here, so a history whose journal lists the files in the order
 * they were generated, each snapshot from the one before, has those of the base first: the
 * branch's follow the last of them, and generating them again would change nothing.
 */
function forks(root: string): boolean {
  const history = readDrizzleMigrations(root);

  return history === undefined || drizzleHistoryFindings(history).length > 0;
}

function refuseConflictMarkers(root: string, journal: string, base: string): void {
  if (CONFLICT_MARKER.test(readIfPresent(path.join(root, journal)))) {
    throw new CliError(
      `${journal} still holds the conflict markers of a merge.`,
      `Take the journal of the base, \`git checkout ${base} -- ${journal}\`, then run the replay again: it finds the migrations of the branch by their files.`,
    );
  }
}

/**
 * drizzle-kit generates the difference between the schema files, as they are at the end of the
 * branch, and the last snapshot: it can generate the changes of the branch again as one migration,
 * never as the steps they were.
 */
function refuseSeveralSchemaChanges(migrations: readonly BranchMigration[]): void {
  const changing = migrations.filter((migration) => !migration.custom).map((migration) => migration.tag);

  if (changing.length > 1) {
    throw new CliError(
      `${changing.length} migrations of this branch change the schema (${changing.join(', ')}): drizzle-kit generates the difference between the schema files and the last snapshot, so it cannot split them again into the steps they were, and one migration in their place would join steps planned apart (a table, then a constraint once it is filled).`,
      "Generate them again one at a time, in their order: delete them (each .sql file, its snapshot under meta/ and its journal entry), undo in the schema files every change of the branch but the first one's, run `npm run db:generate <its name>`, then bring back the next change and run it again, and so on (`git show <commit>:<schema file>` holds the schema of each step). Then the replay again for the custom ones. A worker keeps one working migration and generates it again when its slice changes the schema again.",
    );
  }
}

/** The names without `.sql` of the files listed one per line directly under the migrations folder. */
function sqlTags(listing: string): string[] {
  return listing
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('.sql') && !line.includes('/meta/'))
    .map((line) => path.posix.basename(line, '.sql'))
    .sort();
}

function readIfPresent(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}
