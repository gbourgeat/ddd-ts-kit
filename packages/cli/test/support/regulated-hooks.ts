import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';

export const SETTINGS = '.claude/settings.json';
export const GATE = '.claude/hooks/production-gate.mjs';
export const REFERENCE = '.claude/hooks/change-reference.mjs';

export interface HookRun {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs a hook the way Claude Code does: the JSON of the tool call on its standard input. */
export function runHook(root: string, hook: string, input: unknown, env: Record<string, string> = {}): HookRun {
  const { status, stdout, stderr } = spawnSync(process.execPath, [path.join(root, hook)], {
    cwd: root,
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, RELEASE_APPROVAL: '', ...env },
  });

  return { status, stdout, stderr };
}

/** The hook with its input written `delay` ms after it started, as a harness that defers the write would. */
export function runLate(root: string, hook: string, input: string, delay: number): Promise<HookRun> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(root, hook)], {
      cwd: root,
      env: { ...process.env, RELEASE_APPROVAL: '' },
    });

    let stderr = '';
    let stdout = '';

    child.stderr.on('data', (chunk: Buffer) => (stderr += String(chunk)));
    child.stdout.on('data', (chunk: Buffer) => (stdout += String(chunk)));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
    setTimeout(() => child.stdin.end(input), delay);
  });
}

export const bash = (command: string): unknown => ({ tool_name: 'Bash', tool_input: { command } });

export const edit = (root: string, file: string): unknown => ({
  tool_name: 'Edit',
  cwd: root,
  tool_input: { file_path: path.join(root, file) },
});
