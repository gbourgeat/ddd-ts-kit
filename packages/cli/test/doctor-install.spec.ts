import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { VERSION } from '../src/version';
import { cli, tempDir, write } from './helpers';
import { installHooks } from './support/install-hooks';
import { installKit } from './support/install-kit';
import { jsonAt } from './support/json-at';

let root: string;

function project(manager: 'npm' | 'pnpm'): string {
  const directory = path.join(tempDir(`doctor-install-${manager}`), 'shop');

  cli(directory, 'init', '--context', 'billing:core', '--package-manager', manager);
  installHooks(directory);

  return directory;
}

beforeEach(() => {
  root = project('npm');
});

describe('doctor, on the dependencies of the checkout', () => {
  it('fails --strict without node_modules, and names the clean install in the dialect of the project', () => {
    const result = cli(root, 'doctor', '--strict');

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('What this checkout lacks to run the project');
    expect(result.stdout).toContain('  install node_modules: missing (the dependencies installed)');
    expect(result.stdout).toContain('fix: `npm ci` installs what package-lock.json holds');

    expect(cli(project('pnpm'), 'doctor').stdout).toContain(
      'fix: `pnpm install --frozen-lockfile` installs what pnpm-lock.yaml holds',
    );
  });

  it('says node_modules installed before the lockfile changed, without failing --strict', () => {
    installKit(root);
    write(root, 'package-lock.json', '{}');

    const before = new Date(Date.now() - 60_000);

    fs.utimesSync(path.join(root, 'node_modules', '.package-lock.json'), before, before);

    const result = cli(root, 'doctor', '--strict', '--json');

    expect(result.code).toBe(0);

    expect(jsonAt(result.json(), 'findings')).toEqual([
      expect.objectContaining({ area: 'install', name: 'node_modules', problem: 'outdated' }),
    ]);

    installKit(root);

    expect(cli(root, 'doctor').stdout).toContain('This checkout runs it');
  });

  it('fails --strict on a package of the kit installed at another version or not installed', () => {
    installKit(root);
    write(root, 'node_modules/@ddd-ts-kit/kernel/package.json', JSON.stringify({ version: '0.1.0' }));
    fs.rmSync(path.join(root, 'node_modules', '@ddd-ts-kit', 'http'), { recursive: true });

    const result = cli(root, 'doctor', '--strict');

    expect(result.code).toBe(1);
    expect(result.stdout).toContain(`  install @ddd-ts-kit/http: not installed (${VERSION})`);
    expect(result.stdout).toContain(`  install @ddd-ts-kit/kernel: other version (${VERSION}; yours: 0.1.0)`);
    expect(result.stdout).toContain('fix: upgrade `ddd-ts-kit` and every `@ddd-ts-kit/*` package together');
  });

  it('reads the install of the workspace a project belongs to, and of no other directory above it', () => {
    const above = path.dirname(root);

    installKit(root);
    fs.renameSync(path.join(root, 'node_modules'), path.join(above, 'node_modules'));
    write(above, 'package-lock.json', '{}');
    fs.utimesSync(path.join(above, 'package-lock.json'), new Date(0), new Date(0));

    expect(cli(root, 'doctor').stdout).toContain('  install node_modules: missing (the dependencies installed)');

    write(above, 'package.json', JSON.stringify({ name: 'shops', private: true, workspaces: ['shop'] }));

    expect(cli(root, 'doctor').stdout).toContain('This checkout runs it');

    write(above, 'node_modules/@ddd-ts-kit/kernel/package.json', JSON.stringify({ version: '0.1.0' }));

    expect(cli(root, 'doctor').stdout).toContain(
      `  install @ddd-ts-kit/kernel: other version (${VERSION}; yours: 0.1.0)`,
    );
  });

  it('judges a package of the kit node_modules holds that package.json does not declare', () => {
    installKit(root);
    write(root, 'node_modules/@ddd-ts-kit/kafka/package.json', JSON.stringify({ version: '0.2.0' }));

    expect(jsonAt(cli(root, 'doctor', '--json').json(), 'findings')).toEqual([
      { area: 'install', name: '@ddd-ts-kit/kafka', problem: 'other version', expected: VERSION, found: '0.2.0' },
    ]);
  });

  it('reads the install of a pnpm workspace above the project, named by its pnpm-workspace.yaml', () => {
    const pnpm = project('pnpm');
    const above = path.dirname(pnpm);

    installKit(pnpm);
    fs.renameSync(path.join(pnpm, 'node_modules'), path.join(above, 'node_modules'));
    write(above, 'pnpm-workspace.yaml', "packages:\n  - 'shop'\n");
    write(above, 'pnpm-lock.yaml', 'lockfileVersion: 9\n');
    fs.utimesSync(path.join(above, 'pnpm-lock.yaml'), new Date(0), new Date(0));

    expect(cli(pnpm, 'doctor').stdout).toContain('This checkout runs it');
  });

  it('judges the freshness of the install only where the lockfile is, and nothing without one', () => {
    installKit(root);
    fs.rmSync(path.join(root, 'package-lock.json'), { force: true });
    write(root, 'node_modules/@ddd-ts-kit/kernel/package.json', JSON.stringify({ version: '0.1.0' }));

    expect(jsonAt(cli(root, 'doctor', '--json').json(), 'findings')).toEqual([
      { area: 'install', name: '@ddd-ts-kit/kernel', problem: 'other version', expected: VERSION, found: '0.1.0' },
    ]);
  });

  it('reads a package of the kit whose manifest it cannot parse as not installed', () => {
    installKit(root);
    write(root, 'node_modules/@ddd-ts-kit/kernel/package.json', '{ not json');

    expect(jsonAt(cli(root, 'doctor', '--json').json(), 'findings')).toEqual([
      { area: 'install', name: '@ddd-ts-kit/kernel', problem: 'not installed', expected: VERSION },
    ]);
  });

  it('does not judge the install script of a package whose manifest it cannot read', () => {
    const prisma = path.join(tempDir('doctor-install-prisma'), 'shop');

    cli(prisma, 'init', '--context', 'billing:core', '--package-manager', 'npm', '--orm', 'prisma');
    installKit(prisma);
    write(prisma, 'node_modules/prisma/package.json', JSON.stringify({ name: 'prisma', version: '6.0.0' }));
    write(prisma, 'node_modules/@prisma/engines/package.json', '{ not json');

    const findings = jsonAt(cli(prisma, 'doctor', '--json').json(), 'findings');

    expect(Array.isArray(findings) ? findings.map((finding) => jsonAt(finding, 'area')) : []).not.toContain(
      'install-script',
    );
  });
});
