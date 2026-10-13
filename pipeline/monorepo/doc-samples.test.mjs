import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, test } from 'node:test';
import { collect, compile, samplesOf } from './doc-samples.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const scratch = path.join(ROOT, '.ddd-ts-kit', `doc-samples-test-${process.pid}`);

after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const PAGE = [
  '# Guide',
  '',
  '<!-- checked sample -->',
  '```ts',
  "import { ok } from '@ddd-ts-kit/kernel';",
  '',
  'export const answer = ok(42);',
  '```',
  '',
  'A fragment, not checked:',
  '',
  '```ts',
  'this.state = next;',
  '```',
  '',
  '<!-- checked sample -->',
  '',
  '```typescript',
  'export const count: number = "three";',
  '```',
  '',
  '<!-- checked sample: legacy-decorators -->',
  '```ts',
  'export const legacy = true;',
  '```',
  '',
  '<!-- checked sample -->',
  'Not a fence.',
  '',
].join('\n');

test('takes the TypeScript fences that follow the marker, and only those', () => {
  const { samples, problems } = samplesOf(PAGE);

  assert.deepEqual(
    samples.map(({ line, legacy }) => ({ line, legacy })),
    [
      { line: 4, legacy: false },
      { line: 18, legacy: false },
      { line: 23, legacy: true },
    ],
  );
  assert.equal(samples[0]?.code, "import { ok } from '@ddd-ts-kit/kernel';\n\nexport const answer = ok(42);");
  assert.deepEqual(problems, ['27: a checked sample marker is not followed by a ```ts fence']);
});

test('a marker shown inside a fence, as an example of the convention, is not a marker', () => {
  const example = ['````md', '<!-- checked sample -->', '```ts', 'const x = 1;', '```', '````', ''].join('\n');

  assert.deepEqual(samplesOf(example), { samples: [], problems: [] });
});

test('compiles the samples against the workspace and places each error on the line of its page', () => {
  fs.mkdirSync(scratch, { recursive: true });
  fs.writeFileSync(path.join(scratch, 'guide.md'), PAGE);
  const page = path.relative(ROOT, path.join(scratch, 'guide.md'));
  const { samples } = collect(ROOT, [page]);
  const errors = compile(ROOT, samples, path.join(scratch, 'compiled'));

  assert.equal(errors.length, 1, errors.join('\n'));
  assert.match(errors[0] ?? '', new RegExp(`^${page.replaceAll('.', '\\.')}:19: error TS2322: `));
});
