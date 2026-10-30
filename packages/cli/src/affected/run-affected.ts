import { spawnSync } from 'node:child_process';
import { CliError } from '../cli-error';
import type { Stack } from '../config';
import type { Io } from '../commands/io';
import { inDialect } from '../package-manager/in-dialect';
import { PARTIAL_RUN } from './format-selection';
import type { Selection } from './selection';
import { refuseWindowsShell } from '../refuse-windows-shell';

/** The variable the test runner config reads (`unaffectedContexts()` of @ddd-ts-kit/testing). */
const AFFECTED = 'DDD_TS_KIT_AFFECTED';

/** A script of a project to run on a selection: where, with which package manager, on what. */
export interface AffectedRun {
  readonly root: string;
  readonly manager: Stack['packageManager'];
  readonly selection: Selection;
  readonly script: string;
}

/**
 * Runs a script of the project on the selection, as the pipeline does on a pull request: the
 * contexts it names in `DDD_TS_KIT_AFFECTED`, `--passWithNoTests` on a partial run. Nothing runs
 * when nothing that runs changed. Its output goes straight to the terminal; its exit code is
 * the answer.
 */
export function runAffected({ root, manager, selection, script }: AffectedRun, io: Io): number {
  if (selection.scope === 'none') {
    io.out(`Nothing that runs is affected (${selection.reason}): ${script} is not run.`);

    return 0;
  }

  const partial = selection.scope === 'contexts';
  const command = inDialect(`npm run ${script}${partial ? ` -- ${PARTIAL_RUN}` : ''}`, manager);
  const [program = 'npm', ...args] = command.split(' ');

  io.out(
    partial
      ? `${script} on ${selection.contexts.join(', ')} (${selection.reason}).`
      : `${script} on everything (${selection.reason}).`,
  );

  refuseWindowsShell(process.platform);

  const run = spawnSync(program, args, {
    cwd: root,
    env: { ...process.env, [AFFECTED]: partial ? selection.contexts.join(',') : '' },
    stdio: 'inherit',
  });

  if (run.error !== undefined) {
    throw new CliError(`${program} could not run (${run.error.message}).`, `Is ${program} installed and on the PATH?`);
  }

  return run.status ?? 1;
}
