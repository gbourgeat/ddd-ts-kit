import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { addExtensionsIn } from './add-extensions.mjs';

function distWith(files) {
  const dist = mkdtempSync(join(tmpdir(), 'add-extensions-'));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dist, name, '..'), { recursive: true });
    writeFileSync(join(dist, name), text);
  }
  return dist;
}

test('a file import gets .js and a folder import gets /index.js', () => {
  const dist = distWith({
    'index.js': "export * from './domain/errors';\nexport { x } from './x';\n",
    'x.js': 'export const x = 1;\n',
    'domain/errors/index.js': 'export {};\n',
  });
  addExtensionsIn(dist);
  assert.equal(
    readFileSync(join(dist, 'index.js'), 'utf8'),
    "export * from './domain/errors/index.js';\nexport { x } from './x.js';\n",
  );
});

test('a declaration file is resolved against declaration files and a package is left alone', () => {
  const dist = distWith({
    'index.d.ts':
      "import type { A } from './a';\nimport('./sub').then();\nimport 'node:fs';\nexport * from '@ddd-ts-kit/kernel';\n",
    'a.d.ts': 'export type A = 1;\n',
    'sub/index.d.ts': 'export {};\n',
  });
  addExtensionsIn(dist);
  assert.equal(
    readFileSync(join(dist, 'index.d.ts'), 'utf8'),
    "import type { A } from './a.js';\nimport('./sub/index.js').then();\nimport 'node:fs';\nexport * from '@ddd-ts-kit/kernel';\n",
  );
});

test('a specifier that already has an extension, or points nowhere, is kept and the run is idempotent', () => {
  const text = "import './a.js';\nimport './data.json';\nimport './missing';\n";
  const dist = distWith({ 'index.js': text, 'a.js': '' });
  assert.equal(addExtensionsIn(dist), 0);
  assert.equal(readFileSync(join(dist, 'index.js'), 'utf8'), text);
});
