import { spawnSync } from 'node:child_process';
import type { Io } from '../commands/io';
import { findProjectFormatter } from './find-project-formatter';

/** Enough of a failing formatter to read the cause. */
const TAIL_LINES = 20;

/** Formats files with the formatter of the project, the way its format script does; a formatter that fails or is missing is reported. */
export function formatAsTheProject(root: string, files: readonly string[], io: Io): void {
  if (files.length === 0) {
    return;
  }

  const formatter = findProjectFormatter(root);

  if (typeof formatter === 'string') {
    io.out(`Not formatted (${formatter}): ${files.join(', ')}.`);

    return;
  }

  const run = spawnSync(process.execPath, [formatter.bin, ...formatter.args, ...files], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (run.status === 0) {
    io.out(`Formatted with ${formatter.name}, as the format script does: ${files.join(', ')}.`);

    return;
  }

  const printed = `${run.stdout}${run.stderr}`.trimEnd().split('\n').slice(-TAIL_LINES).join('\n');

  io.err(`Warning: ${formatter.name} failed on ${files.join(', ')}; format them before committing.\n${printed}`);
}
