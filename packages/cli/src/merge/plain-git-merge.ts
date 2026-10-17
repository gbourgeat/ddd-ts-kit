import fs from 'node:fs';
import { CliError } from '../cli-error.js';
import { gitPath } from './git-path.js';
import { gitProcess } from './git-process.js';
import type { StageEntry } from './preview-merge.js';
import { unmergedEntries } from './unmerged-entries.js';

/**
 * Starts the merge with `git merge` itself, for a git older than 2.40 when the base is the one
 * git computes anyway: diff3 markers, nothing committed, the message replaced by merge-trunk's.
 * Answers the stages of each conflicted path.
 */
export function plainGitMerge(
  top: string,
  { trunk, message }: { trunk: string; message: string },
): Map<string, StageEntry[]> {
  const merged = gitProcess(top, [
    '-c',
    'merge.conflictStyle=diff3',
    'merge',
    '--no-ff',
    '--no-commit',
    '--no-edit',
    trunk,
  ]);

  if (merged.status !== 0 && merged.status !== 1) {
    throw new CliError(
      `git merge could not start: ${merged.stderr.trim() || 'no output'}.`,
      'Read the reason above, then merge-trunk again.',
    );
  }

  fs.writeFileSync(gitPath(top, 'MERGE_MSG'), message);

  return unmergedEntries(top);
}
