import type { Repository } from './repository.js';

/** The text of a file at a commit; undefined when the commit has no such file. */
export function fileAt({ root, git }: Repository, sha: string, file: string): string | undefined {
  return git(root, ['show', `${sha}:${file}`]);
}
