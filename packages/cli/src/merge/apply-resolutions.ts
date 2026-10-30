import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../cli-error';
import { refuseLeaving } from '../workspace/refuse-leaving';
import { writeInsideProject } from '../workspace/write-inside-project';
import { gitProcess } from './git-process';
import type { Resolution } from './resolution';

/**
 * Writes what each resolution settled into the working tree of the merge in progress: a settled
 * path is written (or deleted) and staged, which clears its conflict; a path left to a person
 * gets the conflicts that could be settled, and keeps its stages.
 */
export function applyResolutions(top: string, resolutions: readonly Resolution[]): void {
  const changed = resolutions.filter(({ content }) => content !== undefined).map(({ file }) => file);
  const real = refuseLeaving(top, changed, (file) => path.join(top, file));

  for (const { file, content } of resolutions) {
    if (content === null) {
      fs.rmSync(path.join(top, file), { force: true });
    } else if (content !== undefined) {
      writeInsideProject(top, file, content, real.get(file));
    }
  }

  const settled = resolutions.filter((resolution) => resolution.settled).map((resolution) => resolution.file);

  if (settled.length === 0) {
    return;
  }

  const staged = gitProcess(
    top,
    ['--literal-pathspecs', 'add', '--all', '--pathspec-from-file=-', '--pathspec-file-nul'],
    `${settled.join('\0')}\0`,
  );

  if (staged.status !== 0) {
    throw new CliError(
      `git could not stage the paths merge-trunk settled: ${staged.stderr.trim() || 'no output'}.`,
      'Stage them with `git add`, then run `npx ddd-ts-kit merge-trunk --continue`.',
    );
  }
}
