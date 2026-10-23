import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cacheKey, hashOf } from './lint.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('the key of the cache changes with the content of a rule as built, with the config, and with nothing else', () => {
  const today = hashOf([
    ['packages/eslint-plugin/dist/rules/clean-stepdown.js', 'export const rule = 1;'],
    ['eslint.config.mjs', 'export default [];'],
  ]);

  assert.match(today, /^[0-9a-f]{16}$/);
  assert.equal(
    hashOf([
      ['packages/eslint-plugin/dist/rules/clean-stepdown.js', 'export const rule = 1;'],
      ['eslint.config.mjs', 'export default [];'],
    ]),
    today,
  );
  assert.notEqual(
    hashOf([
      ['packages/eslint-plugin/dist/rules/clean-stepdown.js', 'export const rule = 2;'],
      ['eslint.config.mjs', 'export default [];'],
    ]),
    today,
  );
  assert.notEqual(
    hashOf([
      ['packages/eslint-plugin/dist/rules/clean-stepdown.js', 'export const rule = 1;'],
      ['eslint.config.mjs', 'export default [{}];'],
    ]),
    today,
  );
});

test('the key of this repository reads the built plugin, the config and the lockfile, the same way twice', () => {
  assert.match(cacheKey(ROOT), /^[0-9a-f]{16}$/);
  assert.equal(cacheKey(ROOT), cacheKey(ROOT));
});
