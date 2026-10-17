import { spawnSync } from 'node:child_process';
import type { Stack } from '../config/index.js';
import { inDialect } from '../package-manager/in-dialect.js';

/** Enough of a failed install to read its cause, little enough to keep a note short. */
const TAIL_LINES = 15;

/** How the dependencies of a worktree were installed: the command, whether it passed, how long it took. */
export interface DependencyInstall {
  /** As the package manager of the project says it: `npm ci`, `pnpm install --frozen-lockfile`. */
  readonly command: string;
  readonly ok: boolean;
  readonly seconds: number;
  /** The last lines it printed when it failed; empty when it passed. */
  readonly output: string;
}

/**
 * Runs the clean install of the project's package manager in `directory`: what the lockfile
 * says, nothing added. Quiet: its output is kept only when it fails.
 */
export function installDependencies(directory: string, manager: Stack['packageManager']): DependencyInstall {
  const command = inDialect('npm ci', manager);
  const [program = 'npm', ...args] = command.split(' ');
  const started = Date.now();

  const run = spawnSync(program, args, {
    cwd: directory,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const seconds = Math.round((Date.now() - started) / 100) / 10;

  if (run.error !== undefined) {
    return { command, ok: false, seconds, output: `${program} could not run (${run.error.message}): is it installed?` };
  }

  const printed = `${run.stdout}${run.stderr}`.trimEnd().split('\n');

  return {
    command,
    ok: run.status === 0,
    seconds,
    output: run.status === 0 ? '' : printed.slice(-TAIL_LINES).join('\n') || 'no output',
  };
}
