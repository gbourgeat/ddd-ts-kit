import { ACCEPTANCE_DIR } from '../acceptance/acceptance-file-of';
import type { BranchCommit } from './branch-commit';
import type { Repository } from './repository';

const FORMAT = '--format=%x1e%H%x1f%P%x1f%cI%x1f%an%x1f%s%x1f%(trailers:key=Slice,valueonly,separator=%x2C)';

/** The folders whose files the measures read: the stories, their reviews, the incidents, the acceptance specs and locks. */
const READ_FOLDERS = ['docs/architecture', ACCEPTANCE_DIR];

/**
 * Every commit of the current branch, parents first, with the files each one changed under the
 * folders the measures read: one `git log` for the commits, one for their files, so that a store
 * versioned once in the history does not weigh on the answer. Empty outside a repository, or when
 * git is not installed.
 */
export function branchCommits({ root, git }: Repository): BranchCommit[] {
  const commits = git(root, ['log', FORMAT, '--topo-order', '--reverse', 'HEAD']) ?? '';

  const named =
    git(root, [
      'log',
      '--format=%x1e%H',
      '--name-only',
      '--no-renames',
      '--full-history',
      'HEAD',
      '--',
      ...READ_FOLDERS,
    ]) ?? '';

  const files = filesByCommit(named);

  return commits
    .split('\x1e')
    .map((record) => commitOf(record, files))
    .filter((commit): commit is BranchCommit => commit !== undefined);
}

function filesByCommit(output: string): Map<string, string[]> {
  const files = new Map<string, string[]>();

  for (const record of output.split('\x1e')) {
    const [sha = '', ...lines] = record.split('\n');

    files.set(
      sha.trim(),
      lines.map((line) => line.trim()).filter((line) => line !== ''),
    );
  }

  return files;
}

function commitOf(record: string, files: ReadonlyMap<string, readonly string[]>): BranchCommit | undefined {
  const [header = ''] = record.split('\n');
  const [sha = '', parents = '', date = '', author = '', subject = '', trailers = ''] = header.split('\x1f');

  if (sha === '') {
    return undefined;
  }

  return {
    sha,
    parents: parents.split(' ').filter((parent) => parent !== ''),
    at: Date.parse(date),
    author,
    subject,
    slices: trailers
      .split(',')
      .map((slice) => slice.trim().replace(/^#/, ''))
      .filter((slice) => slice !== ''),
    files: [...(files.get(sha) ?? [])],
  };
}
