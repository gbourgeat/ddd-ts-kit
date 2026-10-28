// The arrangement the tests of the guard share: a throwaway project made by the built CLI, a hook input
// for each mode and host, a context worker, a git repository. `npm run test:plugin` runs them.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after } from 'node:test';
import { fileURLToPath } from 'node:url';

// The folder of the hooks, above this one.
export const here = join(dirname(fileURLToPath(import.meta.url)), '..');
export const guard = join(here, 'guard.mjs');
export const cli = join(here, '..', '..', 'packages', 'cli', 'dist', 'bin.js');

// Everything these tests write lives under one directory, removed when they end, passed or failed:
// the projects, and the temporary directory the guard is given for its commit reminder markers.
export const workspace = mkdtempSync(join(tmpdir(), 'ddd-ts-kit-guard-'));
export const guardTemp = join(workspace, 'tmp');

mkdirSync(guardTemp);
after(() => rmSync(workspace, { recursive: true, force: true }));

export function project(config = {}, flags = []) {
  const root = directory('project');
  const init = spawnSync('node', [cli, 'init', '--orm', 'none', '--context', 'ordering:core', ...flags], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(init.status, 0, init.stderr);
  if (Object.keys(config).length > 0) {
    patchConfig(root, config);
  }
  launcher(root);
  return root;
}

export function directory(label) {
  return mkdtempSync(join(workspace, `${label}-`));
}

// A launcher like the one npm writes: the compiled entry file itself is not executable.
export function launcher(root) {
  mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true });
  writeFileSync(join(root, 'node_modules', '.bin', 'ddd-ts-kit'), `#!/bin/sh\nexec node "${cli}" "$@"\n`, {
    mode: 0o755,
  });
}

export function patchConfig(root, patch) {
  const path = join(root, 'ddd-ts-kit.config.json');
  const current = JSON.parse(readFileSync(path, 'utf8'));
  writeFileSync(path, JSON.stringify({ ...current, ...patch }));
}

export function run(mode, input, env = {}) {
  const result = spawnSync('node', [guard, mode], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, TMPDIR: guardTemp, ...env },
  });
  return {
    status: result.status,
    stderr: result.stderr,
    output: result.stdout ? JSON.parse(result.stdout) : undefined,
  };
}

export function put(root, path, content = '') {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}

export function write(file, extra = {}) {
  return { tool_name: 'Write', tool_input: { file_path: file, content: '' }, ...extra };
}

export function patch(root, ...sections) {
  return {
    cwd: root,
    turn_id: 'turn-1',
    tool_name: 'apply_patch',
    tool_input: { command: ['*** Begin Patch', ...sections, '*** End Patch'].join('\n') },
  };
}

export function decision(result) {
  return result.output?.hookSpecificOutput.permissionDecision;
}

export function reason(result) {
  return result.output.hookSpecificOutput.permissionDecisionReason;
}

export function worker(root, context = 'ordering') {
  put(root, '.ddd-ts-kit/worker.json', JSON.stringify({ context }));
  return { agent_type: 'ddd-ts-kit:context-builder' };
}

export function bash(root, command, extra = {}) {
  return { cwd: root, tool_name: 'Bash', tool_input: { command }, ...extra };
}

export function git(root, ...args) {
  const result = spawnSync(
    'git',
    ['-c', 'user.name=guard', '-c', 'user.email=guard@example.test', '-c', 'commit.gpgsign=false', ...args],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
}

export function edit(file, { from, to }, extra = {}) {
  return {
    tool_name: 'Edit',
    tool_input: { file_path: file, old_string: from, new_string: to },
    ...extra,
  };
}

export function committed(config = {}) {
  const root = project(config);
  writeFileSync(join(root, '.gitignore'), 'node_modules\n');
  git(root, 'init', '--quiet');
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--no-verify', '--message', 'chore: bootstrap');
  return root;
}
