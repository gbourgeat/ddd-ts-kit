import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { toYaml } from '../src/yaml/to-yaml.js';
import { changeConfig } from './check-support.js';
import { cli, exists, read, write } from './helpers.js';
import { initProject } from './support/init-project.js';
import { jsonAt } from './support/json-at.js';
import { SHOP_CONTRACT } from './support/shop-contract.js';

const CONFIG = 'ddd-ts-kit.config.json';

describe('init --sdk', () => {
  it('records "sdk", generates the client of the pristine contract and wires the project around it', () => {
    const root = initProject('--sdk', '--package-manager', 'npm');
    const manifest = json(root, 'package.json');

    expect(jsonAt(json(root, CONFIG), 'sdk')).toEqual({ name: '{project}-{document}-client' });
    expect(jsonAt(json(root, 'clients/api/package.json'), 'name')).toBe(`${projectName(root)}-api-client`);
    expect(read(root, 'clients/api/src/runtime.ts')).toContain('export function send');
    expect(jsonAt(manifest, 'workspaces')).toEqual(['clients/*']);
    expect(jsonAt(manifest, 'scripts', 'docs:check')).toMatch(/ && ddd-ts-kit sdk --check$/);
    expect(jsonAt(manifest, 'scripts', 'ci:build')).toBe('npm run build && npm run sdk:build');

    expect(jsonAt(json(root, 'tsconfig.json'), 'compilerOptions', 'paths')).toMatchObject({
      [`${projectName(root)}-api-client`]: ['./clients/api/src/index.ts'],
    });

    expect(jsonAt(json(root, 'biome.json'), 'files', 'includes')).toContain('!**/clients/*/src');
    expect(jsonAt(json(root, 'knip.json'), 'ignoreWorkspaces')).toEqual(['clients/*']);
    expect(jsonAt(json(root, 'knip.json'), 'workspaces', '.', 'project')).toContain('src/**/*.ts');
    expect(jsonAt(json(root, 'knip.json'), 'project')).toBeUndefined();
    expect(read(root, 'package.json')).toContain('"workspaces": [\n    "clients/*"\n  ]');
    expect(cli(root, 'sdk', '--check').code).toBe(0);
    expect(findings(root, 'config/valid')).toEqual([]);
    expect(findings(root, 'imports/alias-declared')).toEqual([]);
  });

  it('lists the clients in pnpm-workspace.yaml under pnpm, the default, which reads no "workspaces"', () => {
    const root = initProject('--sdk');

    expect(read(root, 'pnpm-workspace.yaml')).toMatch(/\npackages:\n {2}- 'clients\/\*'\n$/);
    expect(jsonAt(json(root, 'package.json'), 'workspaces')).toBeUndefined();
    expect(jsonAt(json(root, 'package.json'), 'scripts', 'ci:build')).toBe('pnpm run build && pnpm run sdk:build');
  });

  it('is refused without an HTTP boundary, and init without it writes no client', () => {
    expect(cli(initProject('--http', 'none', '--di', 'manual'), 'sdk').code).toBe(2);
    expect(exists(initProject(), 'clients')).toBe(false);
  });
});

describe('ddd-ts-kit sdk', () => {
  it('asks for the clients in a project that had none, then keeps them current with the contract', () => {
    const root = initProject();

    expect(cli(root, 'sdk', '--check').stdout).toContain('asks for no client');
    expect(cli(root, 'sdk').stdout).toContain('updated      ddd-ts-kit.config.json');
    expect(cli(root, 'sdk').stdout).toBe('Nothing to do.');

    write(root, 'openapi/openapi.yaml', toYaml(SHOP_CONTRACT));

    const stale = cli(root, 'sdk', '--check');

    expect(stale.code).toBe(1);
    expect(stale.stdout).toContain('stale  clients/api/src/operations.ts');
    expect(cli(root, 'sdk').code).toBe(0);
    expect(read(root, 'clients/api/src/operations.ts')).toContain('export function placeOrder(');
    expect(cli(root, 'sdk', '--check', '--json').json()).toEqual({ ok: true, stale: [], unlocked: [] });
  });

  it('says that npm must list a new client in its lockfile, and fails its check until it does', () => {
    const root = initProject('--package-manager', 'npm');

    const lock = (packages: object): string =>
      JSON.stringify({ lockfileVersion: 3, packages: { '': {}, ...packages } });

    write(root, 'package-lock.json', lock({}));

    expect(cli(root, 'sdk').stdout).toContain(
      'note: package-lock.json does not list clients/api yet: run `npm install` and commit package-lock.json',
    );

    const unlocked = cli(root, 'sdk', '--check');

    expect(unlocked.code).toBe(1);
    expect(unlocked.stdout).toMatch(/^package-lock\.json does not list clients\/api yet/);

    write(
      root,
      'package-lock.json',
      lock({ [`node_modules/${projectName(root)}-api-client`]: { resolved: 'clients/api', link: true } }),
    );

    expect(cli(root, 'sdk', '--check', '--json').json()).toEqual({ ok: true, stale: [], unlocked: [] });
  });

  it('keeps the version and the keys a team added to the package.json of a client, and writes the access asked for', () => {
    const root = initProject('--sdk');
    const manifest = 'clients/api/package.json';

    write(root, manifest, JSON.stringify({ ...(json(root, manifest) as object), version: '2.1.0', repository: 'x' }));
    changeConfig(root, { sdk: { name: '@acme/{project}-{document}', access: 'restricted' } });

    expect(cli(root, 'sdk').code).toBe(0);

    expect(json(root, manifest)).toMatchObject({
      name: `@acme/${projectName(root)}-api`,
      version: '2.1.0',
      repository: 'x',
      publishConfig: { access: 'restricted' },
    });

    expect(Object.keys(jsonAt(json(root, 'tsconfig.json'), 'compilerOptions', 'paths') as object)).not.toContain(
      `${projectName(root)}-api-client`,
    );
  });

  it('generates one client per document of a split contract, and names the client of a document that is gone', () => {
    const root = initProject('--sdk');

    fs.rmSync(path.join(root, 'openapi/openapi.yaml'));
    write(root, 'openapi/public.yaml', toYaml(SHOP_CONTRACT));

    write(
      root,
      'openapi/back-office.yaml',
      toYaml({ ...SHOP_CONTRACT, info: { title: 'Back office', version: '1.0.0' } }),
    );

    expect(cli(root, 'sdk').stdout).toContain(
      'note: clients/api is the client of a document the contract no longer has',
    );

    expect(json(root, 'clients/tsconfig.json')).toEqual({
      files: [],
      references: [{ path: './back-office' }, { path: './public' }],
    });

    expect(read(root, 'clients/back-office/README.md')).toContain('The typed client of Back office 1.0.0');
    expect(cli(root, 'sdk', '--check').stdout).toContain('stale  clients/api');
  });

  it('names the client of each document of a split contract after it, and refuses two documents for one client', () => {
    const root = initProject('--sdk');

    write(root, 'openapi/api.yaml', toYaml(SHOP_CONTRACT));

    const shared = cli(root, 'sdk');

    expect(shared.code).toBe(2);

    expect(shared.stderr).toContain(
      'openapi/api.yaml and openapi/openapi.yaml would both write the client clients/api.',
    );

    const documents = ['openapi', 'api'].map((name) => ({ name, title: name, tags: ['orders'] }));

    changeConfig(root, { openapi: { documents } });

    expect(cli(root, 'sdk').code).toBe(0);
    expect(read(root, 'clients/openapi/README.md')).toContain('# ');
    expect(read(root, 'clients/api/src/operations.ts')).toContain('export function placeOrder(');
  });

  it('says which contract it cannot read', () => {
    const root = initProject('--sdk');

    write(root, 'openapi/openapi.yaml', 'paths: [not, the, kit]\n');

    const result = cli(root, 'sdk');

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('openapi/openapi.yaml cannot be read: line 1');
  });
});

describe('config/valid on "sdk"', () => {
  it('reports what npm would not publish as written', () => {
    const root = initProject();

    changeConfig(root, { sdk: true });
    expect(findings(root, 'config/valid')).toEqual(['"sdk" is not an object: no client is generated.']);

    changeConfig(root, { sdk: { name: 'Shop Client', access: 'secret' } });

    expect(findings(root, 'config/valid')).toEqual([
      '"sdk.name" is "Shop Client": npm takes no such package name, or two documents of the contract would share it.',
      '"sdk.access" is "secret": npm publishes with public or restricted access.',
    ]);

    changeConfig(root, { sdk: { access: 'restricted' } });

    expect(findings(root, 'config/valid')).toEqual([
      '"sdk.access" is "restricted" for a package without a scope: npm publishes such a package for everyone or not at all.',
    ]);
  });
});

function json(root: string, file: string): unknown {
  return JSON.parse(read(root, file));
}

function projectName(root: string): string {
  return String(jsonAt(json(root, 'package.json'), 'name'));
}

function findings(root: string, rule: string): string[] {
  const violations = jsonAt(cli(root, 'check', '--rule', rule, '--json').json(), 'violations');

  return Array.isArray(violations) ? violations.map((violation) => String(jsonAt(violation, 'message'))) : [];
}
