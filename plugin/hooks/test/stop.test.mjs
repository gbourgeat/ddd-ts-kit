// The end of a turn: refused while architecture errors remain, then the commit reminder.

import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { cliAnswering, committed, directory, git, guardTemp, project, put, run, SHORT_TIMES } from './support.mjs';

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
  put(root, 'docs/old.md', 'one\ntwo\n');
  put(root, 'docs/kept.md', 'one\n');
  git(root, 'add', 'docs');
  git(root, 'commit', '--quiet', '--no-verify', '--message', 'docs: an old note');
  writeFileSync(join(root, 'README.md'), 'one\ntwo\nthree\nfour\nfive\nsix\n');
  rmSync(join(root, 'docs/old.md'));
  writeFileSync(join(root, 'docs/kept.md'), 'one\ntwo\n');
  const { output } = run('stop', { cwd: root, session_id: `lines-${root}` });
  assert.match(output.systemMessage, /3 changed files and \d+ changed lines/);
  assert.match(output.systemMessage, /project root \(1 files\)/);
  assert.match(output.systemMessage, /docs \(2 files\)/);
});

test('a new file above a megabyte, or one that cannot be opened, counts as a file without lines', () => {
  const root = committed({ commit: { maxFiles: 1, maxLines: 1000 } });
  put(root, 'docs/large.md', 'a line\n'.repeat(200_000));
  symlinkSync(join(root, 'docs/nowhere.md'), join(root, 'docs/gone.md'));
  const { output } = run('stop', { cwd: root, session_id: `sizes-${root}` });
  assert.match(output.systemMessage, /2 changed files and 0 changed lines are uncommitted/);
});

test('in a repository with no commit yet, every file of the project counts as new', () => {
  const root = project({ commit: { maxFiles: 1, maxLines: 100_000 } });
  put(root, '.gitignore', 'node_modules\n');
  git(root, 'init', '--quiet');
  const { output } = run('stop', { cwd: root, session_id: `unborn-${root}` });
  assert.match(output.systemMessage, /\d+ changed files and [1-9]\d* changed lines are uncommitted/);
});

test('the reminder names a query by its use case, and a file at the root of a context as its context files', () => {
  const root = committed({ commit: { maxFiles: 1, maxLines: 1000 } });
  put(root, 'src/contexts/ordering/application/queries/list-orders/list-orders.notes.md', 'a\n');
  put(root, 'src/contexts/ordering/notes.md', 'a\n');
  const { output } = run('stop', { cwd: root, session_id: `slices-${root}` });
  assert.match(output.systemMessage, /ordering: list-orders \(1 files\)/);
  assert.match(output.systemMessage, /ordering: context files \(1 files\)/);
});

test('a reminder over more than eight slices names eight of them and counts the rest', () => {
  const root = committed({ commit: { maxFiles: 1, maxLines: 1000 } });
  for (let index = 0; index < 10; index += 1) {
    put(root, `folder-${index}/note.md`, 'a\n');
  }
  const { output } = run('stop', { cwd: root, session_id: `many-${root}` });
  assert.match(output.systemMessage, /folder-\d \(1 files\) and 2 more\./);
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

test('a guard mode out of the three is read as enforce: it refuses the stop too, and the session says so once', () => {
  const root = project({ guard: 'enforced' });
  put(
    root,
    'src/contexts/ordering/domain/services/pricing.service.ts',
    "import express from 'express';\nexport class Pricing { now() { return express; } }\n",
  );
  assert.equal(run('stop', { cwd: root, stop_hook_active: false }).output.decision, 'block');
  const briefing = run('session', { cwd: root }).output.hookSpecificOutput.additionalContext;
  const said = briefing.split('\n').filter((line) => line.startsWith('guard:'));
  assert.deepEqual(said, ['guard: "enforced" is not a mode (off, advise, enforce): enforce applies.']);
  assert.doesNotMatch(run('session', { cwd: project() }).output.hookSpecificOutput.additionalContext, /not a mode/);
});

test('a check that times out lets the stop through and says how to run it', () => {
  const root = project();
  cliAnswering(root, { check: { violations: [] } }, { check: 5000 });
  put(root, 'docs/notes.md', 'a change for the stop to check\n');
  const stopped = run('stop', { cwd: root, stop_hook_active: false }, SHORT_TIMES).output;
  assert.equal(stopped.decision, undefined);
  assert.equal(stopped.systemMessage, 'architecture check timed out after 1 s: run `npx ddd-ts-kit check`');
});

const WEEK_AGO = new Date(Date.now() - 8 * 24 * 3600 * 1000);

test('the markers of the guard live in the project, and those a week old go at session start', () => {
  const root = committed({ commit: { maxFiles: 1, maxLines: 1000 } });
  put(root, 'docs/a.md', 'a\n');
  put(root, 'docs/b.md', 'b\n');
  assert.match(run('stop', { cwd: root, session_id: `markers-${root}` }).output.systemMessage, /uncommitted/);
  const markers = join(root, '.ddd-ts-kit/guard/markers');
  const [left] = readdirSync(markers);
  assert.match(left, /^commit-reminder-[0-9a-f]{24}$/);
  assert.deepEqual(
    readdirSync(guardTemp).filter((name) => /^ddd-ts-kit-(?!before-write-)/.test(name)),
    [],
  );
  const old = ['markers/stop-0123', 'turns-0123456789abcdef.json', 'outside-0123456789abcdef.json'];
  for (const file of old) {
    put(root, join('.ddd-ts-kit/guard', file), '{}');
    utimesSync(join(root, '.ddd-ts-kit/guard', file), WEEK_AGO, WEEK_AGO);
  }
  put(root, '.ddd-ts-kit/guard/stories.json', '{}');
  utimesSync(join(root, '.ddd-ts-kit/guard/stories.json'), WEEK_AGO, WEEK_AGO);
  run('session', { cwd: root, session_id: `markers-${root}` });
  assert.deepEqual(readdirSync(markers), [left]);
  assert.deepEqual(readdirSync(join(root, '.ddd-ts-kit/guard')).sort(), ['markers', 'stories.json']);
});

test('a folder of markers a repository links elsewhere is neither written nor pruned', () => {
  const root = committed({ commit: { maxFiles: 1, maxLines: 1000 } });
  const elsewhere = directory('elsewhere');
  put(elsewhere, 'commit-reminder-0123', '');
  utimesSync(join(elsewhere, 'commit-reminder-0123'), WEEK_AGO, WEEK_AGO);
  mkdirSync(join(root, '.ddd-ts-kit/guard'), { recursive: true });
  symlinkSync(elsewhere, join(root, '.ddd-ts-kit/guard/markers'));
  put(root, 'docs/a.md', 'a\n');
  put(root, 'docs/b.md', 'b\n');
  const session = { cwd: root, session_id: `linked-${root}` };
  assert.match(run('stop', session).output.systemMessage, /uncommitted/);
  run('session', session);
  assert.deepEqual(readdirSync(elsewhere), ['commit-reminder-0123']);
});

test('a folder of the guard a repository links elsewhere has nothing pruned through the link', () => {
  const root = committed();
  const shared = directory('shared');
  for (const file of ['turns-0123456789abcdef.json', 'markers/stop-0123']) {
    put(shared, file, '{}');
    utimesSync(join(shared, file), WEEK_AGO, WEEK_AGO);
  }
  mkdirSync(join(root, '.ddd-ts-kit'));
  symlinkSync(shared, join(root, '.ddd-ts-kit/guard'));
  run('session', { cwd: root });
  assert.deepEqual(readdirSync(shared).sort(), ['markers', 'turns-0123456789abcdef.json']);
  assert.deepEqual(readdirSync(join(shared, 'markers')), ['stop-0123']);
});

test('a marker the guard cannot leave lets it say and refuse again, never counts as already said', () => {
  const reminded = committed({ commit: { maxFiles: 1, maxLines: 1000 } });
  put(reminded, '.ddd-ts-kit/guard', 'a file where the folder of the guard would be');
  put(reminded, 'docs/a.md', 'a\n');
  put(reminded, 'docs/b.md', 'b\n');
  const session = { cwd: reminded, session_id: `unwritable-${reminded}` };
  for (const _ of [1, 2]) {
    assert.match(run('stop', session).output.systemMessage, /uncommitted/);
  }
  const refused = project();
  put(refused, '.ddd-ts-kit/guard', 'a file where the folder of the guard would be');
  put(
    refused,
    'src/contexts/ordering/domain/services/pricing.service.ts',
    "import express from 'express';\nexport class Pricing { now() { return express; } }\n",
  );
  const stopping = { cwd: refused, sessionId: `unwritable-${refused}` };
  for (const _ of [1, 2]) {
    assert.equal(run('stop', stopping).output.decision, 'block');
  }
});
