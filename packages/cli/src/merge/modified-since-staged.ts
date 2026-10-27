import { gitProcess } from './git-process';
import type { MergeRepository } from './lost/merge-repository';

/** The tracked paths whose working tree differs from the index, relative to the top of the repository. */
export function modifiedSinceStaged({ top }: MergeRepository): readonly string[] {
  return gitProcess(top, ['diff', '--name-only', '-z'])
    .stdout.split('\0')
    .filter((file) => file !== '');
}
