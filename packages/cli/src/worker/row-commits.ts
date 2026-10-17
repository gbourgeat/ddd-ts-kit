import { runGit } from '../commit/run-git.js';

/** The commit that closed a row of a worker, read from its branch. */
export interface RowCommit {
  readonly row: string;
  /** The short hash. */
  readonly commit: string;
  /** True when no `Slice:` trailer names the row: it was matched in order with the `feat(<context>)` commits. */
  readonly byOrder: boolean;
}

/** What a worker's branch is read against. */
export interface RowsOfBranch {
  readonly base: string;
  readonly context: string;
  readonly rows: readonly string[];
}

interface LoggedCommit {
  readonly commit: string;
  readonly subject: string;
  readonly slices: readonly string[];
}

/**
 * The rows of a worker already committed on its branch since its base, in the order of its rows.
 * A commit names its row by its trailer `Slice: <id>`, which `verify-slice` prints in the commit
 * command. A commit written without it (an older kit, a commit by hand) is matched in order: the
 * rows no trailer names take the `feat(<context>)` commits no trailer marks, one each.
 */
export function rowCommits(directory: string, branch: RowsOfBranch): RowCommit[] {
  const logged = commitsSince(directory, branch.base);
  const named = new Map<string, string>();

  for (const { commit, slices } of logged) {
    for (const row of slices) {
      if (!named.has(row)) {
        named.set(row, commit);
      }
    }
  }

  const unnamed = logged.filter(
    ({ subject, slices }) => slices.length === 0 && subject.startsWith(`feat(${branch.context})`),
  );

  let next = 0;

  return branch.rows.flatMap((row): RowCommit[] => {
    const commit = named.get(row);

    if (commit !== undefined) {
      return [{ row, commit, byOrder: false }];
    }

    const ordered = unnamed[next];

    next += 1;

    return ordered === undefined ? [] : [{ row, commit: ordered.commit, byOrder: true }];
  });
}

/** The commits of the branch's own line since the base, oldest first, merges left out. */
function commitsSince(directory: string, base: string): LoggedCommit[] {
  const format = '%h%x1f%s%x1f%(trailers:key=Slice,valueonly,separator=%x2C)%x1e';

  const log = runGit(directory, [
    'log',
    '--reverse',
    '--first-parent',
    '--no-merges',
    `--format=${format}`,
    `${base}..HEAD`,
  ]);

  return (log ?? '')
    .split('\x1e')
    .map((record) => record.trim())
    .filter((record) => record !== '')
    .map((record) => {
      const [commit = '', subject = '', slices = ''] = record.split('\x1f');

      return {
        commit,
        subject,
        slices: slices
          .split(',')
          .map((id) => id.trim().replace(/^#/, ''))
          .filter((id) => id !== ''),
      };
    });
}
