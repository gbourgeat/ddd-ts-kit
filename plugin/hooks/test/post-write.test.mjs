// After a write: the check of the file written, laid out first by the Biome of the project with
// formatOnWrite.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { cli, cliAnswering, directory, git, installed, launcher, patch, project, put, run, write } from './support.mjs';

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

test('with formatOnWrite, the Biome of the project lays a written file out before the check, one file at a time', () => {
  const root = project({ formatOnWrite: true });
  const calls = fakeBiome(root);
  const file = join(root, 'src/contexts/ordering/domain/services/pricing.service.ts');
  put(
    root,
    'src/contexts/ordering/domain/services/pricing.service.ts',
    "import express from 'express';\nconst a=1\nexport class Pricing { now() { return express; } }\n",
  );
  const result = run('post-write', write(file));
  assert.deepEqual(calls(), [`format --write ${file}`]);
  assert.match(readFileSync(file, 'utf8'), /const a = 1;/);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /layer\/domain-purity/);
  const glossary = join(root, 'src/contexts/ordering/CONTEXT.md');
  assert.equal(run('post-write', write(glossary)).status, 0);
  assert.equal(calls().length, 1);
});

// A Biome like the one npm installs, the package @biomejs/biome: it records how it was called, and
// lays the file out.
function fakeBiome(root, { failing = false } = {}) {
  const log = join(root, 'biome-calls.log');
  const lays = failing
    ? 'process.exit(1);'
    : "writeFileSync(file, readFileSync(file, 'utf8').replace('const a=1', 'const a = 1;'));";
  const source = [
    "import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';",
    'const file = process.argv[4];',
    `appendFileSync(${JSON.stringify(log)}, process.argv.slice(2).join(' ') + '\\n');`,
    lays,
    '',
  ].join('\n');
  installed(root, { name: '@biomejs/biome', bin: { biome: 'bin.mjs' }, source });
  return () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : []);
}

test('with formatOnWrite off, without the Biome of the project, or with a Biome that fails, the write is only checked', () => {
  const note = 'src/platform/pricing/pricing-note.ts';
  // A new project has the key on: init writes it; a project turns it off, and the key is read as true only.
  const silent = project({ formatOnWrite: false });
  const unasked = fakeBiome(silent);
  const file = join(silent, note);
  put(silent, note, 'const a=1\nexport const pricingNote = a;\n');
  assert.equal(run('post-write', write(file)).status, 0);
  assert.deepEqual(unasked(), []);
  assert.match(readFileSync(file, 'utf8'), /const a=1/);

  // A biome of node_modules/.bin that is no bin of the package @biomejs/biome is never run.
  const uninstalled = project({ formatOnWrite: true });
  const elsewhere = join(uninstalled, note);
  const marker = join(uninstalled, 'ran');
  put(uninstalled, note, 'const a=1\nexport const pricingNote = a;\n');
  mkdirSync(join(uninstalled, 'node_modules', '.bin'), { recursive: true });
  writeFileSync(join(uninstalled, 'node_modules', '.bin', 'biome'), `#!/bin/sh\ntouch "${marker}"\n`, { mode: 0o755 });
  assert.equal(run('post-write', write(elsewhere)).status, 0);
  assert.match(readFileSync(elsewhere, 'utf8'), /const a=1/);
  assert.equal(existsSync(marker), false);

  const failing = project({ formatOnWrite: true });
  const broken = fakeBiome(failing, { failing: true });
  const other = join(failing, note);
  put(failing, note, 'const a=1\nexport const pricingNote = a;\n');
  assert.equal(run('post-write', write(other)).status, 0);
  assert.equal(broken().length, 1);
  assert.equal(run('post-write', write(other), { DDD_TS_KIT_GUARD: 'off' }).status, 0);
  assert.equal(broken().length, 1);
});

test('a CLI hoisted to a parent by workspaces is the one the guard runs', () => {
  const workspaceRoot = directory('workspaces');
  const root = join(workspaceRoot, 'examples', 'shop');
  mkdirSync(root, { recursive: true });
  const init = spawnSync('node', [cli, 'init', '--orm', 'none', '--context', 'ordering:core'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(init.status, 0, init.stderr);
  git(workspaceRoot, 'init', '--quiet');
  launcher(workspaceRoot);
  const file = join(root, 'src/contexts/ordering/domain/services/pricing.service.ts');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "import express from 'express';\nexport class Pricing { app() { return express; } }\n");
  const result = run('post-write', write(file));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /layer\/domain-purity/);
});

test('a violation the CLI reports without a line or a fix is placed at line 1, with the command that explains it', () => {
  const root = project();
  const file = join(root, 'src/contexts/ordering/domain/order-number.ts');
  put(root, 'src/contexts/ordering/domain/order-number.ts', 'export const next = 1;\n');
  const violation = { ruleId: 'clean/naming', severity: 'error', file: 'order-number.ts', message: 'A name.' };
  cliAnswering(root, { 'check-file': { violations: [violation] } });
  const result = run('post-write', write(file));
  assert.equal(result.status, 2);
  assert.match(
    result.stderr,
    /\[clean\/naming\] order-number\.ts:1 A name\.\n {2}do instead: see `npx ddd-ts-kit explain clean\/naming`/,
  );
});

test('a CLI the guard cannot start lets the written file through', () => {
  const root = project();
  const file = join(root, 'src/contexts/ordering/domain/services/pricing.service.ts');
  put(root, 'src/contexts/ordering/domain/services/pricing.service.ts', "import express from 'express';\n");
  launcher(root, 'not JavaScript: (\n');
  const result = run('post-write', write(file));
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});

test('a patch of many files has its first five checked, and says the others were not', () => {
  const root = project();
  cliAnswering(root, { 'check-file': { violations: [] } });
  const files = Array.from(
    { length: 7 },
    (_, index) => `*** Add File: src/platform/note-${index}.ts\n+export const n = ${index};`,
  );
  const result = run('post-write', patch(root, ...files));
  assert.equal(
    result.output.systemMessage,
    'ddd-ts-kit: 2 more written file(s) not checked here: run `npx ddd-ts-kit check`',
  );
  const one = run('post-write', patch(root, files[0]));
  assert.equal(one.output, undefined);
  const violation = { ruleId: 'clean/naming', severity: 'error', file: 'note-0.ts', message: 'A name.' };
  cliAnswering(root, { 'check-file': { violations: [violation] } });
  const blocked = run('post-write', patch(root, ...files)).output;
  assert.equal(blocked.decision, 'block');
  assert.match(
    blocked.reason,
    /breaks 5 architecture rule\(s\)[\s\S]*\nddd-ts-kit: 2 more written file\(s\) not checked here/,
  );
});
