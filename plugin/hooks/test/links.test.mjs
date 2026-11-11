// A file a worker writes is the file it reaches: a link inside its scope to a file outside, a folder
// of its scope that is a link, a file with another name elsewhere, and a link of the temp directory
// into the project are judged where they land.

import assert from 'node:assert/strict';
import { linkSync, mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { bash, committed, decision, guardTemp, put, reason, run, worker, write } from './support.mjs';

test('a worker writes through no link to a place outside its scope, by the editor tools or by the shell', () => {
  const root = committed({ worktrees: 'advised' });
  const agent = worker(root, 'ordering');
  const context = join(root, 'src/contexts/ordering');
  symlinkSync('../../platform', join(context, 'platform'));
  symlinkSync('../../main.ts', join(context, 'main.ts'));
  symlinkSync('../../platform/new.ts', join(context, 'new.ts'));
  linkSync(join(root, 'package.json'), join(context, 'package.json'));
  symlinkSync(join(guardTemp, 'away.ts'), join(context, 'away.ts'));
  for (const file of ['platform/extra.ts', 'main.ts', 'new.ts', 'package.json', 'away.ts']) {
    const written = run('pre-write', write(join(context, file), agent));
    assert.equal(decision(written), 'deny', file);
    const redirected = run('pre-bash', bash(root, `echo x > src/contexts/ordering/${file}`, agent));
    assert.equal(decision(redirected), 'deny', file);
  }
  assert.match(reason(run('pre-write', write(join(context, 'main.ts'), agent))), /src\/main\.ts/);
  assert.match(reason(run('pre-write', write(join(context, 'away.ts'), agent))), new RegExp(`link to ${guardTemp}`));
  assert.match(reason(run('pre-write', write(join(context, 'package.json'), agent))), /another name/);
  symlinkSync(join(root, 'src/main.ts'), join(guardTemp, 'main-link.ts'));
  assert.equal(decision(run('pre-bash', bash(root, `echo x > ${guardTemp}/main-link.ts`, agent))), 'deny');
  mkdirSync(join(root, '.ddd-ts-kit'), { recursive: true });
  symlinkSync('../src/main.ts', join(root, '.ddd-ts-kit/report.md'));
  assert.equal(decision(run('pre-write', write(join(root, '.ddd-ts-kit/report.md'), agent))), 'deny');
});

test('a link of a worker that stays inside its scope is written freely', () => {
  const root = committed({ worktrees: 'advised' });
  const agent = worker(root, 'ordering');
  put(root, 'src/contexts/ordering/domain/order.ts', 'export {};\n');
  symlinkSync('domain', join(root, 'src/contexts/ordering/model'));
  assert.equal(run('pre-write', write(join(root, 'src/contexts/ordering/model/order.ts'), agent)).output, undefined);
  assert.equal(run('pre-bash', bash(root, 'echo x > src/contexts/ordering/model/notes.md', agent)).output, undefined);
  assert.equal(run('pre-bash', bash(root, `echo x > ${guardTemp}/out.txt`, agent)).output, undefined);
});

test('a folder of the scope of a worker is no hard link: it is moved, removed and copied into as its files are', () => {
  const root = committed({ worktrees: 'advised' });
  const agent = worker(root, 'ordering');
  put(root, 'src/contexts/ordering/domain/order.ts', 'export {};\n');
  mkdirSync(join(root, 'src/contexts/ordering/domain/old/inner'), { recursive: true });
  for (const command of [
    'git mv src/contexts/ordering/domain/old src/contexts/ordering/domain/new',
    'mv src/contexts/ordering/domain/old src/contexts/ordering/domain/new',
    'rmdir src/contexts/ordering/domain/old/inner',
    'rm -r src/contexts/ordering/domain/old',
    'cp src/contexts/ordering/domain/order.ts src/contexts/ordering/domain/old/',
  ]) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
  // A folder outside the scope stays outside it, and a file with two names is still a hard link.
  assert.equal(decision(run('pre-bash', bash(root, 'rm -r src/platform', agent))), 'deny');
  linkSync(join(root, 'package.json'), join(root, 'src/contexts/ordering/domain/old/package.json'));
  const linked = run('pre-bash', bash(root, 'rm src/contexts/ordering/domain/old/package.json', agent));
  assert.equal(decision(linked), 'deny');
});
