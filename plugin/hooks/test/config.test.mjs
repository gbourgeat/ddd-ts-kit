// The config the guard reads: once per run, bounded in size, each field it uses checked for its type.

import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { decision, patchConfig, project, reason, run, write } from './support.mjs';

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
