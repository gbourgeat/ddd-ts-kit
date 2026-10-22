import fs from 'node:fs';
import path from 'node:path';
import { runGit } from '../commit/run-git';
import type { DoctorFinding } from './doctor-finding';

/** A line of `git submodule status` for a submodule not initialised: `-<commit> <path>`. */
const NOT_INITIALISED = /^-(\S+) (.+?)(?: \(.*\))?$/;

/**
 * The submodules `.gitmodules` declares that this checkout has not initialised, as a new worktree
 * has none: `git submodule status` only reads.
 */
export function submoduleFindings(root: string): DoctorFinding[] {
  const top = runGit(root, ['rev-parse', '--show-toplevel'])?.trim();

  if (top === undefined || top === '' || !fs.existsSync(path.join(top, '.gitmodules'))) {
    return [];
  }

  return (runGit(root, ['submodule', 'status']) ?? '').split('\n').flatMap((line): DoctorFinding[] => {
    const [, commit = '', name = ''] = NOT_INITIALISED.exec(line) ?? [];

    return name === ''
      ? []
      : [{ area: 'submodule', name, problem: 'not initialised', expected: `checked out at ${commit.slice(0, 12)}` }];
  });
}
