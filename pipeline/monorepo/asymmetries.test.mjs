import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addedLines } from './asymmetries.mjs';

test('the decisions a diff adds to a registry come with their file and their new line, the rest of the code left out', () => {
  const diff = [
    'diff --git a/pipeline/monorepo/families.mjs b/pipeline/monorepo/families.mjs',
    '--- a/pipeline/monorepo/families.mjs',
    '+++ b/pipeline/monorepo/families.mjs',
    '@@ -40,0 +41,3 @@ const ORM = {',
    "+        tenant: { drizzle: 'the table says it, which the store reads' },",
    '+      },',
    '+',
    '+        // a comment',
    '@@ -90 +93 @@',
    "-      old: 'line',",
    "+      claim: { drizzle: 'the package is written for PostgreSQL alone' },",
  ].join('\n');

  assert.deepEqual(addedLines(diff), [
    {
      file: 'pipeline/monorepo/families.mjs',
      line: 41,
      content: "tenant: { drizzle: 'the table says it, which the store reads' },",
    },
    {
      file: 'pipeline/monorepo/families.mjs',
      line: 93,
      content: "claim: { drizzle: 'the package is written for PostgreSQL alone' },",
    },
  ]);
});
