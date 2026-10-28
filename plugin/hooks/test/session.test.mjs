// The briefing of a session start: the workflow, the map of the contexts, the plan, the version gap, the
// workers to resume.

import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { bash, cli, committed, directory, git, here, project, put, reason, run, worker } from './support.mjs';

test('session start hands the workflow and the context map over as additional context', () => {
  const root = project();
  const { output } = run('session', { cwd: root });
  assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(output.hookSpecificOutput.additionalContext, /ordering \[core\]/);
});

test('session start says when the installed packages are not the version the skills describe', () => {
  // The guard states the version of the CLI: `release-version.mjs` checks that they agree.
  const described = JSON.parse(readFileSync(join(here, '..', '..', 'packages', 'cli', 'package.json'), 'utf8')).version;
  const [major, minor, patch] = described.split('.').map(Number);
  const breaking = (step) => (major === 0 ? `0.${minor + step}.0` : `${major + step}.0.0`);
  const briefing = (installed) => {
    const root = project();
    if (installed !== undefined) {
      put(root, 'node_modules/ddd-ts-kit/package.json', JSON.stringify({ name: 'ddd-ts-kit', version: installed }));
    }
    return run('session', { cwd: root }).output.hookSpecificOutput.additionalContext;
  };

  assert.doesNotMatch(briefing(undefined), /Version gap/);
  assert.doesNotMatch(briefing(`${major}.${minor}.${patch + 1}`), /Version gap/);
  assert.match(briefing(breaking(1)), /Version gap: .* update the plugin/);
  assert.match(briefing(`${breaking(-1)}-rc.1`), /Version gap: .* node_modules\/ddd-ts-kit\/CHANGELOG\.md/);
  assert.match(briefing(breaking(-1)), /npx ddd-ts-kit doctor/);
});

test('session start stays short: one line per context, far below the host limit', () => {
  const root = project();
  const context = run('session', { cwd: root }).output.hookSpecificOutput.additionalContext;
  assert.match(context, /^ordering \[core\] upstreams: none; glossary: 0 terms; 0 aggregates/m);
  assert.ok(context.length < 2000, `${context.length} characters`);
  assert.doesNotMatch(context, /Plan:/);
});

test('session start points to the plan and its next step, so a session resumes cheaply', () => {
  const root = project();
  put(root, 'docs/architecture/plan.md', '# Architecture plan\n\nNext: 6 plan-slices - order the slices of billing\n');
  const context = run('session', { cwd: root }).output.hookSpecificOutput.additionalContext;
  assert.match(context, /Plan: docs\/architecture\/plan\.md .*Next: 6 plan-slices - order the slices of billing/);
});

test('before the bootstrap, a plan alone is enough to resume', () => {
  const root = directory('plan');
  put(root, 'docs/architecture/plan.md', 'Next: 2 bounded-contexts\n');
  const { output } = run('session', { cwd: root });
  assert.match(output.hookSpecificOutput.additionalContext, /Next: 2 bounded-contexts/);
  assert.equal(run('stop', { cwd: root }).output, undefined);
});

test('the formatter advice and the install advice speak the package manager of the project', () => {
  const root = project({}, ['--package-manager', 'pnpm']);
  const prettier = run('pre-bash', bash(root, 'npx prettier --write .', worker(root, 'invoicing')));
  assert.match(reason(prettier), /`pnpm run format` only, then `pnpm run lint:fix`/);
  rmSync(join(root, 'node_modules'), { recursive: true });
  const briefing = run('session', { cwd: root }).output.hookSpecificOutput.additionalContext;
  assert.match(briefing, /The dependencies are not installed here: run `pnpm install --frozen-lockfile`/);
  const npm = project({}, ['--package-manager', 'npm']);
  rmSync(join(npm, 'node_modules'), { recursive: true });
  assert.match(run('session', { cwd: npm }).output.hookSpecificOutput.additionalContext, /run `npm ci`/);
  const manifest = JSON.parse(readFileSync(join(npm, 'package.json'), 'utf8'));
  delete manifest.devDependencies['ddd-ts-kit'];
  writeFileSync(join(npm, 'package.json'), JSON.stringify(manifest));
  assert.match(run('session', { cwd: npm }).output.hookSpecificOutput.additionalContext, /`npm i -D ddd-ts-kit`/);
});

test('session start names the workers to resume, and asks the CLI nothing without a worker worktree', () => {
  const root = committed();
  writeFileSync(join(root, '.gitignore'), 'node_modules\n.ddd-ts-kit/\n');
  const calls = join(root, 'node_modules', 'calls.log');
  writeFileSync(calls, '');
  writeFileSync(
    join(root, 'node_modules', '.bin', 'ddd-ts-kit'),
    `#!/bin/sh\necho "$*" >> "${calls}"\nexec node "${cli}" "$@"\n`,
    { mode: 0o755 },
  );
  assert.doesNotMatch(run('session', { cwd: root }).output.hookSpecificOutput.additionalContext, /Worker to resume/);
  assert.doesNotMatch(readFileSync(calls, 'utf8'), /status/);

  const worktree = join(dirname(root), `${root.split('/').pop()}-ordering`);
  git(root, 'worktree', 'add', '--quiet', '-b', 'build/ordering', worktree);
  put(worktree, '.ddd-ts-kit/worker.json', JSON.stringify({ context: 'ordering', rows: ['3'], base: 'main' }));
  put(worktree, 'src/contexts/ordering/domain/order.ts', 'export const order = 1;\n');
  const old = '2020-01-01T00:00:00.000Z';
  const agent = { agentId: 'a1b2', run: 1, runStartedAt: old, runStartHead: null, lastSeen: old, toolCalls: 80 };
  put(worktree, '.ddd-ts-kit/agent.json', JSON.stringify({ ...agent, rowCosts: {}, lastStop: null }));
  const briefing = run('session', { cwd: root }).output.hookSpecificOutput.additionalContext;
  assert.match(
    briefing,
    /^Worker to resume: build\/ordering \(mid-row, agent a1b2\): `npx ddd-ts-kit worker-scope ordering --resume`, then send what it prints\.$/m,
  );
});
