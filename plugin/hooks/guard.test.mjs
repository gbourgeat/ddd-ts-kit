import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const guard = join(here, 'guard.mjs');
const cli = join(here, '..', '..', 'packages', 'cli', 'dist', 'bin.js');

function project(config = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ddd-ts-kit-guard-'));
  const init = spawnSync('node', [cli, 'init', '--orm', 'none', '--context', 'ordering:core'], { cwd: root, encoding: 'utf8' });
  assert.equal(init.status, 0, init.stderr);
  if (Object.keys(config).length > 0) patchConfig(root, config);
  mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true });
  // A launcher like the one npm writes: the compiled entry file itself is not executable.
  writeFileSync(join(root, 'node_modules', '.bin', 'ddd-ts-kit'), `#!/bin/sh\nexec node "${cli}" "$@"\n`, { mode: 0o755 });
  return root;
}

function patchConfig(root, patch) {
  const path = join(root, 'ddd-ts-kit.config.json');
  const current = JSON.parse(readFileSync(path, 'utf8'));
  writeFileSync(path, JSON.stringify({ ...current, ...patch }));
}

function run(mode, input) {
  const result = spawnSync('node', [guard, mode], { input: JSON.stringify(input), encoding: 'utf8' });
  return { status: result.status, stderr: result.stderr, output: result.stdout ? JSON.parse(result.stdout) : undefined };
}

const write = (file, extra = {}) => ({ tool_name: 'Write', tool_input: { file_path: file, content: '' }, ...extra });

test('session start hands the workflow and the context map over as additional context', () => {
  const root = project();
  const { output } = run('session', { cwd: root });
  assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(output.hookSpecificOutput.additionalContext, /ordering \[core\]/);
});

test('outside a ddd-ts-kit project every mode stays silent', () => {
  const elsewhere = mkdtempSync(join(tmpdir(), 'ddd-ts-kit-none-'));
  for (const mode of ['session', 'pre-write', 'post-write', 'stop']) {
    const result = run(mode, { cwd: elsewhere, ...write(join(elsewhere, 'a.aggregate.ts')) });
    assert.equal(result.status, 0);
    assert.equal(result.output, undefined);
  }
});

test('a new file of a generated role is refused with the generator command', () => {
  const root = project();
  const { output } = run('pre-write', write(join(root, 'src/contexts/ordering/domain/aggregates/order.aggregate.ts')));
  assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /generate aggregate/);
});

test('in advise mode the same write asks instead of refusing', () => {
  const root = project({ guard: 'advise' });
  const { output } = run('pre-write', write(join(root, 'src/contexts/ordering/domain/aggregates/order.aggregate.ts')));
  assert.equal(output.hookSpecificOutput.permissionDecision, 'ask');
});

test('editing an existing role file and creating an ordinary file are allowed', () => {
  const root = project();
  const existing = join(root, 'src/contexts/ordering/ordering.module.ts');
  assert.equal(run('pre-write', write(existing)).output, undefined);
  assert.equal(run('pre-write', write(join(root, 'src/contexts/ordering/infrastructure/persistence/order.mapper.ts'))).output, undefined);
});

test('a generated contract is never edited by hand', () => {
  const root = project();
  const { output } = run('pre-write', write(join(root, 'openapi/openapi.json')));
  assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /docs:generate/);
});

test('the test writer agent cannot touch production code', () => {
  const root = project();
  const agent = { agent_type: 'ddd-ts-kit:domain-test-writer' };
  const production = run('pre-write', write(join(root, 'src/contexts/ordering/ordering.module.ts'), agent));
  assert.equal(production.output.hookSpecificOutput.permissionDecision, 'deny');
  const spec = run('pre-write', write(join(root, 'src/contexts/ordering/test/unit/order.spec.ts'), agent));
  assert.equal(spec.output, undefined);
});

test('a written file that breaks a rule is reported to the model with the fix', () => {
  const root = project();
  const file = join(root, 'src/contexts/ordering/domain/services/pricing.service.ts');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "import express from 'express';\nexport class Pricing { now() { return express; } }\n");
  const result = run('post-write', write(file));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /layer\/domain-purity/);
  assert.match(result.stderr, /do instead/);
});

test('stop is blocked while errors remain, and never twice in a row', () => {
  const root = project();
  const file = join(root, 'src/contexts/ordering/domain/services/pricing.service.ts');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "import express from 'express';\nexport class Pricing { now() { return express; } }\n");
  assert.equal(run('stop', { cwd: root }).output.decision, 'block');
  assert.equal(run('stop', { cwd: root, stop_hook_active: true }).output, undefined);
});

test('malformed input never blocks', () => {
  const result = spawnSync('node', [guard, 'pre-write'], { input: 'not json', encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});
