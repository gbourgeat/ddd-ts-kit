import { describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';
import { readJson } from './support/read-json';
import { stringsAt } from './support/strings-at';
import { commitAll } from './support/commit-all';

const overridesOf = (root: string): unknown => jsonAt(readJson(root, 'package.json'), 'overrides');

describe('init forces qs 6.16, which Stryker pins below, and multer 2.5.0 under Nest, which asks for 2.4.0 exactly', () => {
  it('writes them to the overrides of package.json under npm, multer on Nest alone', () => {
    expect(overridesOf(initProject('--package-manager', 'npm', '--http', 'nest'))).toEqual({
      multer: '^2.5.0',
      qs: '^6.16.0',
    });

    expect(overridesOf(initProject('--package-manager', 'npm', '--http', 'express'))).toEqual({ qs: '^6.16.0' });
  });

  it('writes it to pnpm-workspace.yaml under pnpm, which reads nothing of package.json, after the settings of the kit', () => {
    const nest = initProject('--package-manager', 'pnpm', '--http', 'nest');
    const workspace = read(nest, 'pnpm-workspace.yaml');

    expect(workspace).toMatch(/^strictDepBuilds: false$/m);
    expect(workspace).toMatch(/^overrides:\n {2}multer: '\^2\.5\.0'\n {2}qs: '\^6\.16\.0'\n$/m);
    expect(overridesOf(nest)).toBeUndefined();

    expect(read(initProject('--package-manager', 'pnpm', '--http', 'fastify'), 'pnpm-workspace.yaml')).toMatch(
      /^overrides:\n {2}qs: '\^6\.16\.0'\n$/m,
    );
  });

  it('changes nothing when run again', () => {
    const root = initProject('--package-manager', 'pnpm', '--http', 'nest');
    const before = read(root, 'pnpm-workspace.yaml');

    cli(root, 'init', '--package-manager', 'pnpm', '--http', 'nest');

    expect(read(root, 'pnpm-workspace.yaml')).toBe(before);
  });

  it('keeps an override the project sets for multer, and says so, unless --force', () => {
    const root = tempDir('init');

    write(root, 'package.json', JSON.stringify({ name: 'shop', overrides: { multer: '2.4.0', lodash: '^4.17.0' } }));

    const report = cli(root, 'init', '--package-manager', 'npm', '--http', 'nest', '--json').json();

    expect(stringsAt(report, 'notes').join('\n')).toContain('package.json overrides multer with a range of its own');
    expect(overridesOf(root)).toEqual({ multer: '2.4.0', lodash: '^4.17.0', qs: '^6.16.0' });

    commitAll(root);
    cli(root, 'init', '--package-manager', 'npm', '--http', 'nest', '--force');

    expect(overridesOf(root)).toEqual({ multer: '^2.5.0', lodash: '^4.17.0', qs: '^6.16.0' });
  });

  it('says what to add to overrides of pnpm-workspace.yaml that do not name multer and qs', () => {
    const root = tempDir('init');

    write(root, 'package.json', JSON.stringify({ name: 'shop' }));
    write(root, 'pnpm-workspace.yaml', "overrides:\n  lodash: '^4.17.0'\n");

    const report = cli(root, 'init', '--package-manager', 'pnpm', '--http', 'nest', '--json').json();

    const notes = stringsAt(report, 'notes').join('\n');

    expect(notes).toContain("pnpm-workspace.yaml has overrides of its own: add `multer: '^2.5.0'` to them");
    expect(notes).toContain("pnpm-workspace.yaml has overrides of its own: add `qs: '^6.16.0'` to them");

    expect(read(root, 'pnpm-workspace.yaml')).toBe("overrides:\n  lodash: '^4.17.0'\n");
  });
});
