import type { BranchCommit } from './branch-commit';
import type { Repository } from './repository';

const FORMAT = '--format=%x1e%H%x1f%P%x1f%cI%x1f%an%x1f%s%x1f%(trailers:key=Slice,valueonly,separator=%x2C)';

/**
 * Every commit of the current branch, oldest first, with the files each one changed: one `git log`.
 * Empty outside a repository, or when git is not installed.
 */
export function branchCommits({ root, git }: Repository): BranchCommit[] {
  const output = git(root, ['log', FORMAT, '--name-only', '--reverse', 'HEAD']);

  return (output ?? '')
    .split('\x1e')
    .map((record) => commitOf(record))
    .filter((commit): commit is BranchCommit => commit !== undefined);
}

function commitOf(record: string): BranchCommit | undefined {
  const [header = '', ...rest] = record.split('\n');
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
    files: rest.map((line) => line.trim()).filter((line) => line !== ''),
  };
}
