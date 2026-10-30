// The body of a skill is read whole each time the skill loads, so what one option of `stack` needs is kept in a
// reference file beside it (`wiring/explicit.md`, `access-control/relationships.md`, `persistence/tenancy.md`...),
// which the body names in one line, "under `stack.<key>: <value>`, read `<file>.md` first", and a session reads on
// that stack only. These ceilings hold the bodies of the four skills that moved their references out (#557) a little
// above their size then, counted as `wc -w` counts. Run with `node --test`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const SKILLS = import.meta.dirname;

/** The most words each body may hold, as `wc -w` counts them. */
const CEILINGS = {
  wiring: 1200,
  'access-control': 1900,
  persistence: 1200,
  'use-case': 2200,
};

test('the bodies of wiring, access-control, persistence and use-case stay under their word ceilings', () => {
  const over = Object.entries(CEILINGS)
    .map(([skill, ceiling]) => ({ skill, ceiling, words: wordsOf(path.join(SKILLS, skill, 'SKILL.md')) }))
    .filter(({ words, ceiling }) => words > ceiling)
    .map(({ skill, ceiling, words }) => `${skill}/SKILL.md holds ${words} words, over ${ceiling}`);

  assert.deepEqual(
    over,
    [],
    'a body over its ceiling: put what one stack option needs in a reference file beside the skill, named in one line "under `stack.<key>: <value>`, read `<file>.md` first"',
  );
});

/** The words of a file, split on white space as `wc -w` splits them. */
function wordsOf(file) {
  return fs.readFileSync(file, 'utf8').split(/\s+/).filter(Boolean).length;
}
