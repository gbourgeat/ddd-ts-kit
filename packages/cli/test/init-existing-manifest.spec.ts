import { describe, expect, it } from 'vitest';
import { cli, tempDir, write } from './helpers';
import { jsonAt } from './support/json-at';
import { readJson } from './support/read-json';
import { stringsAt } from './support/strings-at';

describe('init in a project whose package.json says otherwise', () => {
  it('keeps a manifest that is not an ES module and a release of pnpm of its own, and says so', () => {
    const root = tempDir('init');

    write(
      root,
      'package.json',
      JSON.stringify({ name: 'legacy-shop', type: 'commonjs', packageManager: 'pnpm@9.0.0' }),
    );

    const report = cli(root, 'init', '--package-manager', 'pnpm', '--json').json();
    const notes = stringsAt(report, 'notes').join('\n');

    expect(notes).toContain('package.json is not "type": "module"; the generated code is written as ES modules.');
    expect(notes).toContain('package.json keeps its own "packageManager"; the kit was proven with pnpm@');
    expect(jsonAt(readJson(root, 'package.json'), 'type')).toBe('commonjs');
    expect(jsonAt(readJson(root, 'package.json'), 'packageManager')).toBe('pnpm@9.0.0');

    cli(root, 'init', '--package-manager', 'pnpm', '--force');

    expect(jsonAt(readJson(root, 'package.json'), 'packageManager')).not.toBe('pnpm@9.0.0');
  });
});
