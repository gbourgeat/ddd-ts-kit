import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { foldChanges, problemsOf } from './changes.mjs';

const MANIFEST = 'plugin/.claude-plugin/plugin.json';

test('a change of the plugin with its file of changes/ passes, without one it is asked for', () => {
  const fragment = { 'changes/lint-transition.md': '**The lint shows a rule in transition.** Detail.' };

  assert.deepEqual(
    problemsOf(['plugin/skills/quality-gate/SKILL.md', 'changes/lint-transition.md'], files(fragment)),
    [],
  );

  const [missing] = problemsOf(['plugin/skills/quality-gate/SKILL.md'], files());

  assert.match(missing, /reaches the plugin: say what it changes for a user in changes\/<what-it-does>\.md/);
});

/**
 * The files of a pull request as `read` and `readAtBase` give them: the plugin manifest at 0.80.0 on the base,
 * the pages that exist from the root, and the packages of packages/ by their names.
 */
function files(contents = {}, base = { [MANIFEST]: '{ "version": "0.80.0" }' }) {
  return {
    read: (file) => contents[file] ?? '',
    readAtBase: (file) => base[file],
    exists: (file) => ['docs/proposals/privacy-by-design.md', 'packages/cli/README.md'].includes(file),
    packages: ['ddd-ts-kit', '@ddd-ts-kit/eslint-plugin', '@ddd-ts-kit/kernel'],
  };
}

test('a file of changes/ links to a page from the root of the repository, where CHANGELOG.md reads it', () => {
  const fragment = (link) => ({ 'changes/a.md': `**A.** See [the proposal](${link}).` });

  assert.deepEqual(problemsOf(['changes/a.md'], files(fragment('docs/proposals/privacy-by-design.md#part-2'))), []);
  assert.deepEqual(problemsOf(['changes/a.md'], files(fragment('https://example.org/x.md'))), []);
  assert.deepEqual(problemsOf(['changes/a.md'], files(fragment('#the-section'))), []);

  const [outside] = problemsOf(['changes/a.md'], files(fragment('../docs/proposals/privacy-by-design.md')));

  assert.match(outside, /changes\/a\.md links to \.\.\/docs\/proposals\/privacy-by-design\.md, outside the repository/);
  assert.match(outside, /docs\/proposals\/privacy-by-design\.md, not \.\.\/docs/);

  const [nowhere] = problemsOf(['changes/a.md'], files(fragment('docs/concepts/gone.md')));

  assert.match(nowhere, /changes\/a\.md links to docs\/concepts\/gone\.md, which is no file of the repository/);
});

test('a file of changes/ names a package of the kit by the name it is published under', () => {
  const named = (text) => ({ 'changes/a.md': `**A.** ${text}` });

  assert.deepEqual(
    problemsOf(
      ['changes/a.md'],
      files(named('Update `ddd-ts-kit`, `@ddd-ts-kit/eslint-plugin` and `@ddd-ts-kit/kernel/testing`.')),
    ),
    [],
  );

  const [unknown] = problemsOf(['changes/a.md'], files(named('Update `@ddd-ts-kit/cli` to this version.')));

  assert.match(unknown, /changes\/a\.md names @ddd-ts-kit\/cli, which no package of packages\/ is published as/);
  assert.match(unknown, /the CLI is ddd-ts-kit/);
});

test('CHANGELOG.md and the version of the plugin are left to the release', () => {
  const bumped = { [MANIFEST]: '{ "version": "0.81.0" }', 'changes/a.md': '**A.**' };
  const problems = problemsOf(['CHANGELOG.md', MANIFEST, 'changes/a.md'], files(bumped));

  assert.equal(problems.length, 2);
  assert.match(problems[0], /CHANGELOG\.md is written by the release/);
  assert.match(problems[1], /The version of the plugin is the version of the kit, set by the release/);
});

test('another edit of the plugin manifest keeps its version, and passes', () => {
  const described = { [MANIFEST]: '{ "version": "0.80.0", "description": "new words" }', 'changes/a.md': '**A.**' };

  assert.deepEqual(problemsOf([MANIFEST, 'changes/a.md'], files(described)), []);
});

test('the release writes CHANGELOG.md and the version of the plugin', () => {
  const release = { [MANIFEST]: '{ "version": "0.81.0" }' };

  assert.deepEqual(problemsOf(['packages/cli/src/version.ts', 'CHANGELOG.md', MANIFEST], files(release)), []);
});

test('a file of changes/ opens with its summary in bold; the README of the folder is no entry', () => {
  const [plain] = problemsOf(['changes/plain.md', 'changes/README.md'], files({ 'changes/plain.md': 'No summary.' }));

  assert.match(plain, /changes\/plain\.md opens with its summary in bold/);
  assert.deepEqual(problemsOf(['changes/README.md'], files({ 'changes/README.md': '# changes' })), []);
});

test('the release folds the files in the order they reached the trunk, after what Unreleased held, and deletes them', () => {
  const root = repositoryWithChanges();

  try {
    assert.equal(foldChanges(root, '0.28.0'), 2);
    assert.equal(
      fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'),
      '# Changelog\n\nIntro.\n\n## 0.28.0\n\n**Older.** Written before.\n\n**Second.** It landed after.\n\n**First.** Named first, landed last.\n\n## 0.27.0\n\n**Released.**\n',
    );
    assert.deepEqual(fs.readdirSync(path.join(root, 'changes')), ['README.md']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/** A repository whose CHANGELOG.md has an Unreleased section, and two files of changes/ committed an hour apart, `second.md` first. */
function repositoryWithChanges() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'changes-fold-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe', env: { ...process.env, ...dates } });
  let dates = { GIT_COMMITTER_DATE: '2026-10-18T10:00:00' };
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };

  git('init', '--quiet');
  git('config', 'user.email', 'kit@example.com');
  git('config', 'user.name', 'kit');
  write(
    'CHANGELOG.md',
    '# Changelog\n\nIntro.\n\n## Unreleased\n\n**Older.** Written before.\n\n## 0.27.0\n\n**Released.**\n',
  );
  write('changes/README.md', '# changes\n');
  write('changes/second.md', '**Second.** It landed after.\n');
  git('add', '.');
  git('commit', '--quiet', '-m', 'second');
  dates = { GIT_COMMITTER_DATE: '2026-10-18T11:00:00' };
  write('changes/first.md', '**First.** Named first, landed last.\n');
  git('add', '.');
  git('commit', '--quiet', '-m', 'first');

  return root;
}
