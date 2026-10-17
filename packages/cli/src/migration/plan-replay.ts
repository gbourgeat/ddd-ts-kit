import fs from 'node:fs';
import path from 'node:path';
import { drizzleOutFolder } from '../check/migrations/drizzle-out-folder.js';
import { CliError } from '../cli-error.js';
import { runGit } from '../commit/run-git.js';
import type { BranchMigration } from './branch-migration.js';
import { branchMigrations } from './branch-migrations.js';
import { migrationFiles } from './migration-files.js';
import type { ReplayPlan } from './replay-plan.js';

const CONFLICT_MARKER = /^(?:<{7}|={7}|>{7})(?: |$)/m;

/**
 * The migrations of the branch that `base` does not have, by their `.sql` files, read before
 * anything is deleted. Refused, with the fix: a journal that still holds conflict markers, a base
 * that is not a commit, a base with migrations the branch has not merged, and more than one
 * migration of the branch that changes the schema.
 */
export function planReplay({ root, base }: Pick<ReplayPlan, 'root' | 'base'>): ReplayPlan {
  const folder = drizzleOutFolder(root);

  refuseConflictMarkers(root, `${folder}/meta/_journal.json`, base);
  refuseUnknownBase(root, base);

  const onBase = sqlTags(runGit(root, ['ls-tree', '--name-only', base, '--', `${folder}/`]) ?? '');
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

  refuseSeveralSchemaChanges(migrations);

  return { root, base, folder, migrations };
}

function refuseConflictMarkers(root: string, journal: string, base: string): void {
  if (CONFLICT_MARKER.test(readIfPresent(path.join(root, journal)))) {
    throw new CliError(
      `${journal} still holds the conflict markers of a merge.`,
      `Take the journal of the base, \`git checkout ${base} -- ${journal}\`, then run the replay again: it finds the migrations of the branch by their files.`,
    );
  }
}

function refuseUnknownBase(root: string, base: string): void {
  if (runGit(root, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`]) === undefined) {
    throw new CliError(
      `${base} is not a commit of this repository.`,
      'Fetch it (`git fetch origin`), or name the trunk the branch merged with `--base <ref>`.',
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
      `${changing.length} migrations of this branch change the schema (${changing.join(', ')}): drizzle-kit generates the difference between the schema files and the last snapshot, so it can generate them again only as one.`,
      'Delete them (each .sql file, its snapshot under meta/ and its journal entry) and run `npm run db:generate <what-it-does>` once, then the replay again for the custom ones. A worker keeps one working migration and generates it again when its slice changes the schema again.',
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
