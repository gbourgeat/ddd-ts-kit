import { describe, expect, it } from 'vitest';
import { initProject } from './support/init-project';
import { readJson } from './support/read-json';
import { jsonAt } from './support/json-at';

describe('init dependencies of the test runner', () => {
  it('gives vitest and its coverage the same range, so an install resolves them to one version', () => {
    const manifest = readJson(initProject(), 'package.json');
    const vitest = jsonAt(manifest, 'devDependencies', 'vitest');

    expect(jsonAt(manifest, 'devDependencies', '@vitest/coverage-v8')).toBe(vitest);
    expect(vitest).toMatch(/^\^/);
  });
});
