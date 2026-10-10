import { spawnSync } from 'node:child_process';
import type { Invocation } from '../e2e/run-in.js';

const QUIET = { DATABASE_URL: '', OTEL_SDK_DISABLED: 'true', NO_COLOR: '1', FORCE_COLOR: '0' };

export interface ToolRun {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs a tool in the copy and answers what it printed, whatever its exit code: a finding is an answer here. */
export function toolRun(root: string, { command, args, env = {} }: Invocation): ToolRun {
  const run = spawnSync(command, [...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...QUIET, ...env },
  });

  return { code: run.status ?? 1, stdout: run.stdout, stderr: run.stderr };
}
