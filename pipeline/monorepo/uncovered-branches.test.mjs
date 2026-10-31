import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { report, uncoveredBranches } from './uncovered-branches.mjs';

const SCRIPT = path.resolve(import.meta.dirname, 'uncovered-branches.mjs');

const LCOV = [
  'TN:',
  'SF:plugin/hooks/guard.mjs',
  'DA:10,1',
  'BRDA:10,0,0,1',
  'BRDA:10,0,1,0',
  'BRDA:42,3,0,-',
  'BRF:3',
  'BRH:1',
  'end_of_record',
  'SF:plugin/hooks/stop.mjs',
  'BRDA:7,0,0,2',
  'BRF:1',
  'BRH:1',
  'end_of_record',
  '',
].join('\n');

test('names each branch never taken under its file, a block never reached included', () => {
  assert.deepEqual(uncoveredBranches(LCOV), [
    { file: 'plugin/hooks/guard.mjs', line: 10, block: 0, branch: 1 },
    { file: 'plugin/hooks/guard.mjs', line: 42, block: 3, branch: 0 },
  ]);
});

test('says so when every branch was taken', () => {
  assert.deepEqual(uncoveredBranches('SF:a.mjs\nBRDA:1,0,0,1\nend_of_record\n'), []);
  assert.equal(report([]), 'Every branch was taken.');
});

test('prints one line per branch, with the file and the line a reader opens', () => {
  const lcov = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'uncovered-branches-')), 'plugin.lcov');
  fs.writeFileSync(lcov, LCOV);

  const printed = spawnSync(process.execPath, [SCRIPT, lcov], { encoding: 'utf8' });

  assert.equal(printed.status, 0);
  assert.equal(
    printed.stdout,
    'plugin/hooks/guard.mjs:10 branch 1 of block 0, never taken\nplugin/hooks/guard.mjs:42 branch 0 of block 3, never taken\n',
  );
});

test('refuses to run without a file', () => {
  const refused = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });

  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /usage/);
});
