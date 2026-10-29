// The arrangement the tests of the guard share: a throwaway project made by the built CLI, a hook input
// for each mode and host, a context worker, a git repository. `npm run test:plugin` runs them.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The folder of the hooks, above this one.
export const here = join(dirname(fileURLToPath(import.meta.url)), '..');
export const guard = join(here, 'guard.mjs');
export const cli = join(here, '..', '..', 'packages', 'cli', 'dist', 'bin.js');
// The built CLI as a module a launcher imports: it reads its arguments from the process, as its bin does.
export const cliModule = pathToFileURL(cli).href;

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

// The CLI installed as npm installs it, the package ddd-ts-kit in node_modules: the guard runs the
// bin its manifest names, with Node. `source` is that bin, by default one that hands every command
// to the built CLI.
export function launcher(root, source = `await import(${JSON.stringify(cliModule)});\n`) {
  installed(root, { name: 'ddd-ts-kit', bin: { 'ddd-ts-kit': 'bin.mjs' }, source });
}

// A package of node_modules with its manifest and its one bin file, `bin.mjs`, linked from
// node_modules/.bin under each command of `bin` as npm links it.
export function installed(root, { name, bin, source }) {
  const home = join(root, 'node_modules', ...name.split('/'));
  mkdirSync(home, { recursive: true });
  writeFileSync(join(home, 'package.json'), JSON.stringify({ name, bin }));
  writeFileSync(join(home, 'bin.mjs'), `#!/usr/bin/env node\n${source}`, { mode: 0o755 });
  mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true });
  for (const command of Object.keys(bin)) {
    rmSync(join(root, 'node_modules', '.bin', command), { force: true });
    symlinkSync(join('..', name, 'bin.mjs'), join(root, 'node_modules', '.bin', command));
  }
}

// The version the manifest of the installed CLI states.
export function installedVersion(root, version) {
  const path = join(root, 'node_modules', 'ddd-ts-kit', 'package.json');
  writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path, 'utf8')), version }));
}

// A CLI of the project that answers some of its commands with the report given, and hands every other
// command to the built CLI; a command of `delays` first sleeps that many milliseconds.
export function cliAnswering(root, answers, delays = {}) {
  const reports = join(root, 'node_modules', '.reports');
  mkdirSync(reports, { recursive: true });
  for (const [command, report] of Object.entries(answers)) {
    writeFileSync(join(reports, command), JSON.stringify(report));
  }
  for (const [command, ms] of Object.entries(delays)) {
    writeFileSync(join(reports, `${command}.delay`), String(ms));
  }
  launcher(
    root,
    [
      "import { existsSync, readFileSync } from 'node:fs';",
      `const report = ${JSON.stringify(reports)} + '/' + process.argv[2];`,
      "const delay = existsSync(`${report}.delay`) ? Number(readFileSync(`${report}.delay`, 'utf8')) : 0;",
      'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);',
      `if (existsSync(report)) process.stdout.write(readFileSync(report, 'utf8')); else await import(${JSON.stringify(cliModule)});`,
      '',
    ].join('\n'),
  );
}

// The guard with its time limits shrunk to a fiftieth: a CLI that sleeps reaches them in a test.
export const SHORT_TIMES = { DDD_TS_KIT_GUARD_TIME_SCALE: '0.02' };

export function patchConfig(root, patch) {
  const path = join(root, 'ddd-ts-kit.config.json');
  const current = JSON.parse(readFileSync(path, 'utf8'));
  writeFileSync(path, JSON.stringify({ ...current, ...patch }));
}

// The guard in one mode, given one hook input, with the environment of the test and `env` over it.
export function run(mode, input, env = {}) {
  return guardIn(undefined, mode, { input, env });
}

// The guard started in `directory`, as a host that sends no working directory in its input starts it.
export function runFrom(directory, mode, input) {
  return guardIn(directory, mode, { input, env: {} });
}

function guardIn(directory, mode, { input, env }) {
  const result = spawnSync('node', [guard, mode], {
    cwd: directory,
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
