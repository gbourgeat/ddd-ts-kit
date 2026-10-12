import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { ELSEWHERE, problems, selected, SHARDS, specFiles } from './e2e-shards.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const seconds = SHARDS.map((shard) => Object.values(shard).reduce((sum, duration) => sum + duration, 0));

test('every end-to-end spec file of the stacks is run by exactly one runner', () => {
  assert.deepEqual(problems(specFiles()), []);
  assert.ok(specFiles().length >= 11);
});

test('the files left out are the ones other jobs of the pipeline run by name', () => {
  const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts;
  const named = `${scripts['ci:test:alias']} ${scripts['ci:test:managers']}`;
  const left = fs.readdirSync(path.join(ROOT, 'packages/cli/test/e2e')).filter((file) => file.endsWith('.spec.ts'));

  for (const file of left.filter((candidate) => ELSEWHERE.some((pattern) => pattern.test(candidate)))) {
    assert.ok(named.includes(`packages/cli/test/e2e/${file}`), `${file} is run by no job`);
  }
});

test('reports a file no runner has, one two runners have, and one that is gone', () => {
  const shards = [{ 'a.spec.ts': 1, 'gone.spec.ts': 1 }, { 'a.spec.ts': 1 }];

  assert.deepEqual(problems(['a.spec.ts', 'new.spec.ts'], shards), [
    'new.spec.ts is assigned to no runner',
    'a.spec.ts is assigned twice',
    'gone.spec.ts no longer exists',
  ]);
});

test('answers the files of one runner, every file without the flag, and nothing for a runner that does not exist', () => {
  assert.deepEqual(selected(['--shard=1/4']), Object.keys(SHARDS[0]));
  assert.deepEqual(selected(['--reporter=dot', '--shard=4/4']), Object.keys(SHARDS[3]));
  assert.equal(selected([]).length, specFiles().length);
  assert.equal(selected(['--shard=5/4']), undefined);
  assert.equal(selected(['--shard=1/3']), undefined);
});

test('is balanced: the longest runner is within a fifth of the mean, and no move of one file would shorten it', () => {
  const longest = Math.max(...seconds);
  const mean = seconds.reduce((sum, duration) => sum + duration, 0) / seconds.length;
  const from = seconds.indexOf(longest);

  assert.equal(SHARDS.length, 4);
  assert.ok(longest <= mean * 1.2, `${seconds.join(', ')} seconds`);

  for (const duration of Object.values(SHARDS[from])) {
    const moved = seconds.map((total, index) => (index === from ? total : total + duration));

    assert.ok(moved.filter((_total, index) => index !== from).every((total) => total >= longest));
  }
});
