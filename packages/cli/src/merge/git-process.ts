import { spawnSync } from 'node:child_process';
import { gitArguments } from '../commit/git-arguments';

/** What git answered: its exit status and what it printed. */
export interface GitAnswer {
  /** Null when git could not run. */
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Runs git in `directory`, with `input` on its standard input, and answers its status and output
 * whatever the status: `merge-tree` exits 1 on a conflict and still prints the tree it wrote.
 * Only the user's own repository is read or changed.
 */
export function gitProcess(directory: string, args: readonly string[], input?: string): GitAnswer {
  const run = spawnSync('git', gitArguments(args), {
    cwd: directory,
    encoding: 'utf8',
    input: input ?? '',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}
