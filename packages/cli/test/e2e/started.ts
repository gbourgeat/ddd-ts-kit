import { spawnSync } from 'node:child_process';

const RESOLUTION_FAILURE =
  /ERR_MODULE_NOT_FOUND|ERR_PACKAGE_IMPORT_NOT_DEFINED|ERR_PACKAGE_PATH_NOT_EXPORTED|ERR_INVALID_MODULE_SPECIFIER|ERR_UNSUPPORTED_DIR_IMPORT|Cannot find (?:module|package)/;

/** No service, no configuration: an entry point either stops on what it misses or keeps running. */
const BARE = { PATH: process.env['PATH'] ?? '', OTEL_SDK_DISABLED: 'true', NO_COLOR: '1' };
const PATIENCE_MS = 6000;

export interface Started {
  /** Everything the process printed. */
  readonly output: string;
  /** True when it was still running after the wait and was stopped: it had started. */
  readonly running: boolean;
  /** True when it ended by itself without an error. */
  readonly done: boolean;
  /** True when Node could not resolve a module: the only failure that is about imports. */
  readonly unresolved: boolean;
}

/**
 * Starts a process of a project and waits a few seconds. ES modules are linked before any of
 * them runs: once the process prints an error of its own code, or keeps running, every import of
 * its whole graph was resolved.
 */
export function started(root: string, command: string, args: readonly string[]): Started {
  const run = spawnSync(command, [...args], {
    cwd: root,
    encoding: 'utf8',
    env: BARE,
    timeout: PATIENCE_MS,
    killSignal: 'SIGKILL',
  });

  const output = `${run.stdout}\n${run.stderr}`;

  return {
    output,
    running: run.error !== undefined && run.status === null,
    done: run.status === 0,
    unresolved: RESOLUTION_FAILURE.test(output),
  };
}
