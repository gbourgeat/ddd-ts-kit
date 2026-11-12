import path from 'node:path';
import { runGit } from '../../commit/run-git';
import { inOrder } from './in-order';
import type { NamedOrm, OrderedMigration } from './ordered-migration';

const FOLDERS = { knex: 'migrations', prisma: 'prisma/migrations', typeorm: 'migrations' } as const;
/** What knex and TypeORM load from the folder; a declaration file is not one. */
const SCRIPT = /(?<!\.d)\.(?:js|ts|mjs|cjs)$/;
/** A class whose name ends with 13 digits, for `git grep -E`, which reads a commit without a checkout. */
const STAMPED_CLASS = 'class[[:space:]]+[A-Za-z_$][A-Za-z0-9_$]*[0-9]{13}';

/**
 * What the tool of an ORM takes for a migration in a commit, read from git, in the order it runs
 * them: the trunk a branch has to follow. The same shapes as `migrationsOfTree`.
 */
export function migrationsOfCommit(root: string, orm: NamedOrm, commit: string): OrderedMigration[] {
  const folder = FOLDERS[orm];

  if (orm === 'typeorm') {
    return inOrder(orm, stampedIn(runGit(root, ['grep', '-I', '-o', '-E', STAMPED_CLASS, commit, '--', folder])));
  }

  const files = (runGit(root, ['ls-tree', '-r', '--name-only', commit, '--', `${folder}/`]) ?? '')
    .split('\n')
    .filter((file) => file !== '');

  return inOrder(
    orm,
    files.flatMap((file) => (orm === 'prisma' ? folderOf(file, folder) : scriptOf(file, folder))),
  );
}

/** `<commit>:<file>:class <Name><stamp>` on each line of `git grep`; the first class of a file names it. */
function stampedIn(matches: string | undefined): OrderedMigration[] {
  const byFile = new Map<string, OrderedMigration>();

  for (const line of (matches ?? '').split('\n')) {
    const [, file, stamp] = /^[^:]+:(.+):class\s+\S*?(\d{13})$/.exec(line) ?? [];

    if (file !== undefined && stamp !== undefined && SCRIPT.test(file) && !byFile.has(file)) {
      byFile.set(file, { name: path.posix.basename(file).replace(SCRIPT, ''), file, key: stamp });
    }
  }

  return [...byFile.values()];
}

function folderOf(file: string, folder: string): OrderedMigration[] {
  const [name = '', held, ...deeper] = file.slice(folder.length + 1).split('/');

  return held === 'migration.sql' && deeper.length === 0 ? [{ name, file, key: name }] : [];
}

function scriptOf(file: string, folder: string): OrderedMigration[] {
  const entry = file.slice(folder.length + 1);
  const name = entry.replace(SCRIPT, '');

  return entry.includes('/') || name === entry ? [] : [{ name, file, key: name }];
}
