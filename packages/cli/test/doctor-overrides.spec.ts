import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers';
import { installKit } from './support/install-kit';
import { jsonAt } from './support/json-at';

function installed(manager: 'npm' | 'pnpm', http: string): string {
  const root = path.join(tempDir(`doctor-overrides-${manager}`), 'shop');

  cli(root, 'init', '--package-manager', manager, '--http', http);
  installKit(root);

  return root;
}

/** A package as an install leaves it: its manifest, with the range it asks for each dependency. */
function writePackage(root: string, directory: string, dependencies: Record<string, string>): void {
  write(root, `${directory}/package.json`, JSON.stringify({ name: path.basename(directory), dependencies }));
}

const withoutOverrides = (root: string): void => {
  const manifest: Record<string, unknown> = JSON.parse(read(root, 'package.json'));

  write(root, 'package.json', JSON.stringify({ ...manifest, overrides: undefined }));
};

const findingsOf = (root: string): unknown => jsonAt(cli(root, 'doctor', '--json').json(), 'findings');

describe('doctor, on the overrides init writes under a dependency that pins a package below a fix', () => {
  it('says nothing while the dependency still pins it and the project forces the fix', () => {
    const root = installed('npm', 'nest');

    writePackage(root, 'node_modules/@nestjs/platform-express', { multer: '2.4.0' });
    writePackage(root, 'node_modules/@stryker-mutator/core', { 'typed-rest-client': '~2.3.0' });
    writePackage(root, 'node_modules/typed-rest-client', { qs: '6.15.1' });

    expect(findingsOf(root)).toEqual([]);
  });

  it('fails --strict on an override the project lacks while the dependency pins the package below the fix', () => {
    const root = installed('npm', 'nest');

    writePackage(root, 'node_modules/@nestjs/platform-express', { multer: '2.4.0' });
    withoutOverrides(root);

    const result = cli(root, 'doctor', '--strict');

    expect(result.code).toBe(1);

    expect(result.stdout).toContain(
      '  override multer: missing (multer ^2.5.0 in overrides of package.json; yours: @nestjs/platform-express asks for multer 2.4.0)',
    );

    expect(result.stdout).toContain('fix: `npx ddd-ts-kit init` adds what is missing');
  });

  it('says to remove an override once the dependency asks for the fixed version itself, without failing --strict', () => {
    const root = installed('npm', 'express');

    writePackage(root, 'node_modules/@stryker-mutator/core', { 'typed-rest-client': '^3.1.2' });
    writePackage(root, 'node_modules/typed-rest-client', { qs: '^6.16.0' });

    const result = cli(root, 'doctor', '--strict');

    expect(result.code).toBe(0);

    expect(result.stdout).toContain(
      '  override qs: no longer needed (no override: typed-rest-client asks for qs ^6.16.0; yours: qs forced in overrides of package.json)',
    );

    expect(result.stdout).toContain('fix: remove the override from the file it names, then install again');
    expect(result.stdout).not.toContain('fix: `npx ddd-ts-kit init` adds what is missing');
  });

  it('reads the chain from the real place of each package under pnpm, and the overrides of pnpm-workspace.yaml', () => {
    const root = installed('pnpm', 'nest');
    const store = 'node_modules/.pnpm/@stryker-mutator+core@10.1.1/node_modules';

    writePackage(root, `${store}/@stryker-mutator/core`, { 'typed-rest-client': '~2.3.0' });
    writePackage(root, `${store}/typed-rest-client`, { qs: '^6.16.0' });
    fs.mkdirSync(path.join(root, 'node_modules/@stryker-mutator'));

    fs.symlinkSync(
      path.join(root, store, '@stryker-mutator/core'),
      path.join(root, 'node_modules/@stryker-mutator/core'),
    );

    writePackage(root, 'node_modules/@nestjs/platform-express', { multer: '2.4.0' });

    expect(findingsOf(root)).toEqual([
      expect.objectContaining({
        area: 'override',
        name: 'qs',
        problem: 'no longer needed',
        found: 'qs forced in overrides of pnpm-workspace.yaml',
      }),
    ]);
  });

  it('judges multer on Nest alone, and nothing of a chain that is not installed', () => {
    const root = installed('npm', 'express');

    writePackage(root, 'node_modules/@nestjs/platform-express', { multer: '2.4.0' });
    withoutOverrides(root);

    expect(findingsOf(root)).toEqual([]);
  });

  it('judges nothing of a chain whose manifest it cannot read', () => {
    const root = installed('npm', 'nest');

    write(root, 'node_modules/@nestjs/platform-express/package.json', '{ not json');
    withoutOverrides(root);

    expect(findingsOf(root)).toEqual([]);
  });
});
