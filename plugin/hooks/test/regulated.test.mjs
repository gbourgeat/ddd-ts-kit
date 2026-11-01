// The regulated profile: hooks run outside the sandbox and a sandboxed command may write the project, so
// the guard runs no program the project holds, and what tells it so is out of reach of that command.

import assert from 'node:assert/strict';
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  bash,
  cliAnswering,
  committed,
  decision,
  directory,
  git,
  installed,
  installedVersion,
  launcher,
  patch,
  put,
  reason,
  run,
  worker,
  write,
} from './support.mjs';

const PROFILE = ['--agent-profile', 'regulated'];
const NOTICE =
  /^Regulated profile: the guard runs no program of this project, neither its CLI nor its Biome, at any hook: the pipeline and the commit gate hold those checks, and `(?:npx|pnpm exec) ddd-ts-kit check` runs them here\.$/m;
const SERVICE = 'src/contexts/ordering/domain/services/pricing.service.ts';

test('under the regulated profile no program of the project runs, whichever the hook', () => {
  const root = committed({ formatOnWrite: true, dependenciesBeforeWrite: true }, PROFILE);
  const ran = plantedPrograms(root);
  everyHook(root);
  assert.deepEqual(ran(), []);
});

test('under the default profile the guard still runs the CLI and the Biome of the project', () => {
  const root = committed({ formatOnWrite: true, dependenciesBeforeWrite: true });
  const ran = plantedPrograms(root);
  everyHook(root);
  for (const program of ['list', 'story', 'check-file', 'format', 'check']) {
    assert.ok(ran().includes(program), `${program} did not run: ${ran()}`);
  }
});

test('a config rewritten to drop the profile, or the guard mode, lifts nothing: the settings hold it', () => {
  const root = committed({ formatOnWrite: true }, PROFILE);
  const { agents, ...config } = JSON.parse(readFileSync(join(root, 'ddd-ts-kit.config.json'), 'utf8'));
  assert.equal(agents.profile, 'regulated');
  rewrittenConfig(root, config);
  const ran = plantedPrograms(root);
  everyHook(root);
  assert.deepEqual(ran(), []);
  rewrittenConfig(root, { ...config, guard: 'enforce', agents: { profile: 'none' } });
  everyHook(root);
  assert.deepEqual(ran(), []);
  writeFileSync(join(root, 'ddd-ts-kit.config.json'), '{ broken');
  everyHook(root);
  assert.deepEqual(ran(), []);
});

test('the profile in the config alone holds on a host with no sandbox settings', () => {
  const root = committed({ agents: { profile: 'regulated' }, formatOnWrite: true });
  const { sandbox } = settingsOf(root);
  assert.equal(sandbox, undefined);
  const ran = plantedPrograms(root);
  everyHook(root);
  assert.deepEqual(ran(), []);
});

test('a project planted below a regulated one, with its own config, repository and packages, runs nothing', () => {
  const root = committed({}, PROFILE);
  const below = join(root, 'tmp-of-a-command');
  put(below, 'ddd-ts-kit.config.json', '{}');
  git(below, 'init', '--quiet');
  const ran = plantedPrograms(below);
  everyHook(below, 'src/x.ts');
  assert.deepEqual(ran(), []);
});

test('a sandbox that lets a command out of it is no profile, nor the settings of a folder another user writes', () => {
  const open = committed();
  put(open, '.claude/settings.json', JSON.stringify({ sandbox: { enabled: true, allowUnsandboxedCommands: true } }));
  const ran = plantedPrograms(open);
  run('session', { cwd: open, source: 'startup' });
  assert.ok(ran().includes('list'));

  const shared = directory('shared');
  put(shared, '.claude/settings.json', JSON.stringify({ sandbox: { enabled: true, allowUnsandboxedCommands: false } }));
  chmodSync(shared, 0o777);
  const inside = join(shared, 'project');
  put(inside, 'ddd-ts-kit.config.json', '{}');
  const runs = plantedPrograms(inside);
  run('session', { cwd: inside, source: 'startup' });
  assert.deepEqual(runs(), ['list']);
});

test('the session start says it in one line, with what it reads itself, and never asks for an install', () => {
  const root = committed({}, PROFILE);
  plantedPrograms(root);
  installedVersion(root, '0.0.1');
  const lines = run('session', { cwd: root, source: 'startup' }).output.hookSpecificOutput.additionalContext;
  assert.equal(lines.match(new RegExp(NOTICE, 'gm')).length, 1);
  assert.match(lines, /Version gap: this plugin describes ddd-ts-kit .*, the project has 0\.0\.1 installed/);
  assert.doesNotMatch(lines, /not installed/);
  assert.doesNotMatch(lines, /^Contexts:$/m);

  const uninstalled = committed({}, PROFILE);
  rmSync(join(uninstalled, 'node_modules'), { recursive: true });
  const without = run('session', { cwd: uninstalled, source: 'startup' }).output.hookSpecificOutput.additionalContext;
  assert.match(without, NOTICE);
  assert.doesNotMatch(without, /not installed|Version gap/);
});

test('a default project hears nothing of the profile', () => {
  const root = committed();
  const lines = run('session', { cwd: root, source: 'startup' }).output.hookSpecificOutput.additionalContext;
  assert.doesNotMatch(lines, /Regulated profile/);
  assert.match(lines, /^Contexts:$/m);
});

test('a stop does not block on a check that did not run, says no check ran well, and keeps what it reads itself', () => {
  const report = { violations: [{ severity: 'error', ruleId: 'x/y', file: 'a.ts', message: 'broken', line: 1 }] };
  const root = committed({ commit: { maxFiles: 1 } }, PROFILE);
  cliAnswering(root, { check: report, story: { phases: [{ id: 'report', met: false }], next: 'report' } });
  put(root, '.ddd-ts-kit/story.json', JSON.stringify({ story: 'US5', base: 'main', branch: 'story/us5' }));
  put(root, 'src/platform/one.ts', 'export const one = 1;\n');
  put(root, 'src/platform/two.ts', 'export const two = 2;\n');
  const stopped = run('stop', { cwd: root, session_id: 'regulated' });
  assert.equal(stopped.status, 0);
  assert.equal(stopped.output.decision, undefined);
  assert.match(stopped.output.systemMessage, /uncommitted \(advised at most 1 files/);
  assert.doesNotMatch(stopped.output.systemMessage, /architecture|check/);

  const clean = committed({}, PROFILE);
  cliAnswering(clean, { check: report });
  put(clean, 'src/platform/one.ts', 'export const one = 1;\n');
  assert.equal(run('stop', { cwd: clean, session_id: 'regulated' }).output, undefined);
});

test('after a write nothing is checked, so no file is said to be left out of the check', () => {
  const root = committed({}, PROFILE);
  plantedPrograms(root);
  const files = Array.from({ length: 7 }, (_, index) => `src/platform/note-${index}.ts`);
  for (const file of files) {
    put(root, file, 'export const a = 1;\n');
  }
  const result = run('post-write', patch(root, ...files.map((file) => `*** Update File: ${file}\n+const a=1`)));
  assert.equal(result.status, 0);
  assert.equal(result.output, undefined);
});

test('the rules the guard reads itself keep running', () => {
  const root = committed({}, PROFILE);
  const ran = plantedPrograms(root);
  const generated = run('pre-write', write(join(root, '.dependency-cruiser.cjs')));
  assert.equal(decision(generated), 'deny');
  assert.match(reason(generated), /is generated from ddd-ts-kit\.config\.json/);
  const skipped = run('pre-bash', bash(root, 'git commit --no-verify -m x'));
  assert.equal(decision(skipped), 'deny');
  const agent = worker(root, 'ordering');
  const stray = run('pre-write', write(join(root, 'src/contexts/billing/domain/x.ts'), agent));
  assert.equal(decision(stray), 'deny');
  assert.deepEqual(ran(), []);
});

test('a worker is not told of the packages the guard runs: under the profile it runs none', () => {
  const root = committed({}, PROFILE);
  plantedPrograms(root);
  const agent = { ...worker(root, 'ordering'), session_id: 'ignored', agent_id: 'builder-1' };
  const manifest = join(root, 'node_modules/ddd-ts-kit/package.json');
  assert.equal(run('pre-bash', bash(root, 'npm test', agent)).output, undefined);
  writeFileSync(manifest, `${readFileSync(manifest, 'utf8')} `);
  assert.equal(run('pre-bash', bash(root, 'npm test', agent)).output, undefined);
});

// What a sandboxed command may leave in the project: the CLI and the Biome of node_modules replaced by
// a program that records each run.
function plantedPrograms(root) {
  const log = join(root, 'ran.log');
  const source = `import { appendFileSync } from 'node:fs';\nappendFileSync(${JSON.stringify(log)}, process.argv[2] + '\\n');\n`;
  launcher(root, source);
  installed(root, { name: '@biomejs/biome', bin: { biome: 'bin.mjs' }, source });
  return () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : []);
}

// Each mode of the guard, in the worktree of a story, on a pending change that would reach each of its
// runs: the session start, a write that adds an import, a shell command, the check after it, both stops.
function everyHook(root, path = SERVICE) {
  put(root, '.ddd-ts-kit/story.json', JSON.stringify({ story: 'US5', base: 'main', branch: 'story/us5' }));
  put(root, 'docs/architecture/slices.md', '# Slices\n');
  put(root, path, 'export class Pricing {}\n');
  const file = join(root, path);
  const base = { cwd: root, session_id: 'regulated' };
  const content = "import express from 'express';\nexport class Pricing {}\n";
  const written = { tool_name: 'Write', tool_input: { file_path: file, content } };
  const builder = { agent_type: 'ddd-ts-kit:context-builder', agent_id: 'builder-1' };
  run('session', { ...base, source: 'startup' });
  run('pre-write', { ...base, ...written });
  run('pre-bash', { ...base, ...bash(root, 'npm test') });
  run('post-write', { ...base, ...written });
  run('stop', base);
  run('subagent-start', { ...base, ...builder });
  run('subagent-stop', { ...base, ...builder });
}

function rewrittenConfig(root, config) {
  writeFileSync(join(root, 'ddd-ts-kit.config.json'), JSON.stringify(config));
}

function settingsOf(root) {
  return JSON.parse(readFileSync(join(root, '.claude/settings.json'), 'utf8'));
}
