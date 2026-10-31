#!/usr/bin/env node
// Names the branches no test took, from the lcov the test runner of Node wrote (`--test-reporter=lcov`): the coverage
// table says which file is under its floor, not which branch. One line per branch, `<file>:<line> branch <n> of block
// <b>`, or one line saying every branch was taken. Answers 0 either way: the floor already decided.
//
//   node pipeline/monorepo/uncovered-branches.mjs coverage/plugin.lcov
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const [lcov] = process.argv.slice(2);

  if (lcov === undefined) {
    console.error('usage: node pipeline/monorepo/uncovered-branches.mjs <lcov file>');
    process.exit(2);
  }

  console.log(report(uncoveredBranches(fs.readFileSync(lcov, 'utf8'))));
}

/**
 * The branches an lcov report holds as never taken: each `BRDA:<line>,<block>,<branch>,<taken>` whose
 * `taken` is 0 or `-` (the block was never reached), under the `SF:` file it belongs to.
 */
export function uncoveredBranches(lcov) {
  const found = [];
  let file = '';

  for (const line of lcov.split('\n')) {
    if (line.startsWith('SF:')) {
      file = line.slice('SF:'.length);
    }

    const branch = /^BRDA:(\d+),(\d+),(\d+),(\d+|-)$/.exec(line);

    if (branch !== null && (branch[4] === '0' || branch[4] === '-')) {
      found.push({ file, line: Number(branch[1]), block: Number(branch[2]), branch: Number(branch[3]) });
    }
  }

  return found;
}

/** The lines a reader gets: one per branch never taken, or the sentence that says there is none. */
export function report(branches) {
  if (branches.length === 0) {
    return 'Every branch was taken.';
  }

  return branches
    .map(({ file, line, block, branch }) => `${file}:${line} branch ${branch} of block ${block}, never taken`)
    .join('\n');
}
