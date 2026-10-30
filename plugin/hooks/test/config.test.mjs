// The config the guard reads: once per run, bounded in size, each field it uses checked for its type.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { bash, committed, decision, patchConfig, project, reason, run, worker, write } from './support.mjs';

const BARREL = 'application/application.declarations.ts';

test('a context named after a property of every object is a context like any other', () => {
  const root = project({ contexts: { constructor: { modules: { orders: {} } } } });
  for (const context of ['constructor', '__proto__', 'toString', 'constructor/orders']) {
    const refused = run('pre-write', write(join(root, 'src/contexts', context, BARREL)));
    assert.equal(decision(refused), 'deny', context);
    assert.match(reason(refused), /holds generated declarations of its context/);
  }
});

test('a field of the config of the wrong type falls back to its default', () => {
  const root = project({
    contextsDir: 5,
    sourceRoot: ['lib'],
    platformDir: {},
    sharedKernelDir: '',
    contexts: 'ordering',
  });
  const refused = run('pre-write', write(join(root, 'src/contexts/ordering', BARREL)));
  assert.equal(decision(refused), 'deny');
  assert.match(
    reason(refused),
    /^ddd-ts-kit: src\/contexts\/ordering\/application\/application\.declarations\.ts holds/,
  );
});

test('a config that is no object of JSON is read as the defaults', () => {
  const root = project();
  for (const text of ['{ not json', '[1, 2]', 'null']) {
    writeFileSync(join(root, 'ddd-ts-kit.config.json'), text);
    assert.equal(decision(run('pre-write', write(join(root, 'src/contexts/ordering', BARREL)))), 'deny', text);
  }
});

test('a config larger than the guard reads is not read: the session says so, and the guard judges nothing', () => {
  const root = project();
  patchConfig(root, { padding: 'x'.repeat(300_000) });
  assert.equal(run('pre-write', write(join(root, 'src/contexts/ordering', BARREL))).output, undefined);
  const briefing = run('session', { cwd: root }).output.hookSpecificOutput.additionalContext;
  assert.match(
    briefing,
    /^ddd-ts-kit\.config\.json holds \d+ KB, more than the 256 KB the guard reads: it judges nothing in this project until the config is smaller\.$/m,
  );
});

test('a config, a plan, a scope file or a changed file that is a device or a FIFO is read as no text, at once', () => {
  const generated = (root) => decision(run('pre-write', write(join(root, 'openapi/openapi.yaml'))));
  const config = project();
  rmSync(join(config, 'ddd-ts-kit.config.json'));
  symlinkSync('/dev/zero', join(config, 'ddd-ts-kit.config.json'));
  assert.equal(generated(config), 'deny');
  const fifo = project();
  rmSync(join(fifo, 'ddd-ts-kit.config.json'));
  assert.equal(spawnSync('mkfifo', [join(fifo, 'ddd-ts-kit.config.json')]).status, 0);
  assert.equal(generated(fifo), 'deny');
  const plan = project();
  mkdirSync(join(plan, 'docs/architecture'), { recursive: true });
  symlinkSync('/dev/zero', join(plan, 'docs/architecture/plan.md'));
  assert.match(run('session', { cwd: plan }).output.hookSpecificOutput.additionalContext, /Contexts:/);
  const scope = project();
  const agent = worker(scope, 'ordering');
  rmSync(join(scope, '.ddd-ts-kit/worker.json'));
  symlinkSync('/dev/zero', join(scope, '.ddd-ts-kit/worker.json'));
  assert.equal(run('pre-bash', bash(scope, 'echo x > src/main.ts', agent)).output, undefined);
  const changed = committed();
  symlinkSync('/dev/zero', join(changed, 'zeros'));
  assert.equal(run('session', { cwd: changed }).status, 0);
  const noted = committed();
  const builder = worker(noted, 'ordering');
  assert.equal(run('pre-bash', bash(noted, 'node -e "1"', builder)).output, undefined);
  symlinkSync('/dev/zero', join(noted, 'zeros'));
  assert.equal(decision(run('pre-bash', bash(noted, 'npm test', builder))), 'deny');
});
