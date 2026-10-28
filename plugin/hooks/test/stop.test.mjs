// The end of a turn: refused while architecture errors remain, then the commit reminder.

import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { committed, git, project, put, run } from './support.mjs';

test('stop is blocked while errors remain, and never twice in a row', () => {
  const root = project();
  const file = join(root, 'src/contexts/ordering/domain/services/pricing.service.ts');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "import express from 'express';\nexport class Pricing { now() { return express; } }\n");
  assert.equal(run('stop', { cwd: root }).output.decision, 'block');
  assert.equal(run('stop', { cwd: root, stop_hook_active: true }).output, undefined);
});

test('a host that does not say the stop was refused is refused once for the same errors', () => {
  const root = project();
  put(
    root,
    'src/contexts/ordering/domain/services/pricing.service.ts',
    "import express from 'express';\nexport class Pricing { now() { return express; } }\n",
  );
  const stopping = { cwd: root, sessionId: `session-${Date.now()}` };
  assert.equal(run('stop', stopping).output.decision, 'block');
  assert.equal(run('stop', stopping).output, undefined);
  assert.equal(run('stop', { ...stopping, stop_hook_active: false }).output.decision, 'block');
});

test('at stop, a tree above the commit limits is reminded once, by slice, and never blocks', () => {
  const root = committed({ commit: { maxFiles: 3, maxLines: 1000 } });
  const session = { cwd: root, session_id: `s-${root}` };
  assert.equal(run('stop', session).output, undefined);
  for (const file of [
    'application/commands/place-order/place-order.notes.md',
    'presentation/http/place-order.route.ts',
    'test/unit/place-order.handler.spec.ts',
    'domain/value-objects/money.notes.md',
  ]) {
    put(root, join('src/contexts/ordering', file), 'one\ntwo\n');
  }
  put(root, 'src/platform/extra.md', 'one\n');
  const first = run('stop', session);
  assert.equal(first.status, 0);
  assert.equal(first.output.decision, undefined);
  assert.match(
    first.output.systemMessage,
    /5 changed files and 9 changed lines are uncommitted \(advised at most 3 files and 1000 lines/,
  );
  assert.match(first.output.systemMessage, /ordering: place-order \(3 files\), /);
  assert.match(first.output.systemMessage, /ordering: domain \(1 files\)/);
  assert.match(first.output.systemMessage, /platform \(1 files\)/);
  assert.match(first.output.systemMessage, /commit-discipline/);
  assert.equal(run('stop', session).output, undefined);
  assert.match(run('stop', { ...session, session_id: 'another' }).output.systemMessage, /uncommitted/);
});

test('the reminder comes back after a commit when the tree grows again', () => {
  const root = committed({ commit: { maxFiles: 1, maxLines: 1000 } });
  const session = { cwd: root, session_id: `again-${root}` };
  put(root, 'docs/a.md', 'a\n');
  put(root, 'docs/b.md', 'b\n');
  assert.match(run('stop', session).output.systemMessage, /docs \(2 files\)/);
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--no-verify', '--message', 'docs: notes');
  assert.equal(run('stop', session).output, undefined);
  put(root, 'docs/c.md', 'c\n');
  put(root, 'docs/d.md', 'd\n');
  assert.match(run('stop', session).output.systemMessage, /2 changed files/);
});

test('changed lines count against their own limit, deletions and edits included', () => {
  const root = committed({ commit: { maxFiles: 50, maxLines: 5 } });
  writeFileSync(join(root, 'README.md'), 'one\ntwo\nthree\nfour\nfive\nsix\n');
  const { output } = run('stop', { cwd: root, session_id: `lines-${root}` });
  assert.match(output.systemMessage, /1 changed files and \d+ changed lines/);
  assert.match(output.systemMessage, /project root \(1 files\)/);
});

test('generated files are not counted in the size of a commit', () => {
  // Advise mode: the stale barrel written below must not turn this stop into an architecture block.
  const root = committed({ guard: 'advise', commit: { maxFiles: 1, maxLines: 1000 } });
  put(root, 'docs/a.md', 'a\n');
  for (const path of [
    'src/contexts/ordering/ordering.declarations.ts',
    'src/contexts/ordering/application/application.declarations.ts',
    'openapi/openapi.yaml',
    'openapi/back-office.yaml',
    'docs/integration/asyncapi.yaml',
    'docs/context-map.md',
    'package-lock.json',
    '.dependency-cruiser.cjs',
    '.ddd-ts-kit/worker.json',
  ]) {
    put(root, path, 'changed\n'.repeat(50));
  }
  assert.equal(run('stop', { cwd: root, session_id: `generated-${root}` }).output, undefined);
  put(root, 'docs/b.md', 'b\n');
  assert.match(
    run('stop', { cwd: root, session_id: `generated-${root}` }).output.systemMessage,
    /2 changed files and 2 changed lines/,
  );
});

test('the default commit limits apply when the config says nothing', () => {
  const root = committed({});
  for (let index = 0; index < 20; index += 1) {
    put(root, `docs/note-${index}.md`, 'a\n');
  }
  assert.equal(run('stop', { cwd: root, session_id: `defaults-${root}` }).output, undefined);
  put(root, 'docs/note-20.md', 'a\n');
  assert.match(
    run('stop', { cwd: root, session_id: `defaults-${root}` }).output.systemMessage,
    /at most 20 files and 600 lines/,
  );
});

test('nonsense commit limits are an error of the configuration, reported as such', () => {
  const root = committed({ commit: { maxFiles: 'many', maxLines: -1 } });

  put(root, 'docs/note.md', 'a\n');

  assert.match(run('stop', { cwd: root, session_id: `nonsense-${root}` }).output.reason, /commit\.maxFiles/);
});

test('session start repeats the commit reminder, and stop then stays quiet', () => {
  const root = committed({ commit: { maxFiles: 1, maxLines: 1000 } });
  const session = { cwd: root, session_id: `start-${root}` };
  put(root, 'docs/a.md', 'a\n');
  put(root, 'docs/b.md', 'b\n');
  assert.match(run('session', session).output.hookSpecificOutput.additionalContext, /2 changed files .* uncommitted/);
  assert.equal(run('stop', session).output, undefined);
  assert.match(run('session', session).output.hookSpecificOutput.additionalContext, /uncommitted/);
});

test('architecture errors block the stop before any word about commits', () => {
  const root = committed({ commit: { maxFiles: 1, maxLines: 1 } });
  put(
    root,
    'src/contexts/ordering/domain/services/pricing.service.ts',
    "import express from 'express';\nexport class Pricing { now() { return express; } }\n",
  );
  put(root, 'docs/a.md', 'a\n');
  const { output } = run('stop', { cwd: root, session_id: `errors-${root}` });
  assert.equal(output.decision, 'block');
  assert.equal(output.systemMessage, undefined);
});

test('with the guard off, and outside a git repository, nothing is said about commits', () => {
  const silent = committed({ guard: 'off', commit: { maxFiles: 1, maxLines: 1 } });
  put(silent, 'docs/a.md', 'a\n');
  put(silent, 'docs/b.md', 'b\n');
  assert.equal(run('stop', { cwd: silent, session_id: 'off' }).output, undefined);
  const untracked = project({ commit: { maxFiles: 1, maxLines: 1 } });
  put(untracked, 'docs/a.md', 'a\n');
  assert.equal(run('stop', { cwd: untracked, session_id: 'no-git' }).output, undefined);
});
