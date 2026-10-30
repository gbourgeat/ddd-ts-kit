import { spawnSync } from 'node:child_process';
import type { ScriptCall } from './script-call';
import type { ScriptRun } from './script-run';
import { refuseWindowsShell } from '../refuse-windows-shell';

/** Enough of a failing run to read the cause, little enough to keep an agent's context. */
const TAIL_LINES = 40;

/**
 * Runs a script of the project's package.json with its package manager, the arguments handed
 * over to the script (`npm test -- billing`, `pnpm test billing`). The output is kept only when
 * the script fails.
 */
export function runScript({ root, manager, script, args = [] }: ScriptCall): ScriptRun {
  const handOver = manager === 'npm' && args.length > 0 ? ['--'] : [];

  refuseWindowsShell(process.platform);

  const run = spawnSync(manager, ['run', script, ...handOver, ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (run.error !== undefined) {
    return { ok: false, output: `${manager} could not run (${run.error.message}): is it installed?` };
  }

  if (run.status === 0) {
    return { ok: true, output: '' };
  }

  const printed = `${run.stdout}${run.stderr}`.trimEnd().split('\n');

  return { ok: false, output: printed.slice(-TAIL_LINES).join('\n') || 'no output' };
}
