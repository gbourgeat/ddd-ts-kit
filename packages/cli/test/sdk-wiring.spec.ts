import { describe, expect, it } from 'vitest';
import { sdkScripts } from '../src/sdk/sdk-scripts.js';
import { withKnipWorkspaces } from '../src/sdk/with-knip-workspaces.js';
import { cli, read, write } from './helpers.js';
import { initProject } from './support/init-project.js';

describe('the wiring of the clients', () => {
  it('extends each script once, and leaves a script that already runs the generator or delegates to docs:check', () => {
    const scripts = {
      'docs:generate': 'ddd-ts-kit docs',
      'docs:check': 'node scripts/kit.mjs docs --check && node scripts/kit.mjs sdk --check',
      'ci:docs': 'npm run docs:check',
      'ci:build': 'npm run build',
    };

    const wired = sdkScripts(scripts);

    expect(wired).toEqual({
      'docs:generate': 'ddd-ts-kit docs && ddd-ts-kit sdk',
      'docs:check': scripts['docs:check'],
      'ci:docs': 'npm run docs:check',
      'ci:build': 'npm run build && npm run sdk:build',
      'sdk:generate': 'ddd-ts-kit sdk',
      'sdk:build': 'node node_modules/@typescript/native/bin/tsc -b clients',
    });

    expect(sdkScripts(wired)).toEqual(wired);
    expect(sdkScripts({})).toEqual({ 'sdk:generate': 'ddd-ts-kit sdk', 'sdk:build': wired['sdk:build'] });
  });

  it('names the root as a workspace of knip once, and keeps a config that already lists its workspaces', () => {
    const flat = { $schema: 's', entry: ['a.ts'], project: ['src/**'], vitest: { config: [] }, ignoreBinaries: ['x'] };
    const wired = withKnipWorkspaces(flat, 'clients/*');

    expect(wired).toEqual({
      $schema: 's',
      workspaces: { '.': { entry: ['a.ts'], project: ['src/**'], vitest: { config: [] } } },
      ignoreBinaries: ['x'],
      ignoreWorkspaces: ['clients/*'],
    });

    expect(withKnipWorkspaces(wired, 'clients/*')).toEqual(wired);

    expect(withKnipWorkspaces({ entry: [] }, 'clients/*')).toEqual({
      workspaces: { '.': { entry: [] } },
      ignoreWorkspaces: ['clients/*'],
    });
  });

  it('lets the generators enter what knip reads in the root workspace, once the clients made one', () => {
    const root = initProject('--sdk', '--package-manager', 'npm');

    expect(cli(root, 'generate', 'context', 'billing', '--classification', 'core').code).toBe(0);
    expect(cli(root, 'generate', 'worker').code).toBe(0);

    const knip: unknown = JSON.parse(read(root, 'knip.json'));

    expect(knip).not.toHaveProperty('entry');
    expect(knip).toHaveProperty(['workspaces', '.', 'entry'], expect.arrayContaining(['src/apps/*/main.ts']));
    expect(read(root, 'knip.json')).toContain('published-language/index');
  });

  it('says what it cannot rewrite: a tsconfig with comments, a pnpm workspace that lists its own packages', () => {
    const root = initProject('--package-manager', 'pnpm');

    write(root, 'tsconfig.json', `// edited by hand\n${read(root, 'tsconfig.json')}`);
    write(root, 'pnpm-workspace.yaml', 'packages:\n  - tools/*\n');

    const notes = cli(root, 'sdk').stdout;

    expect(notes).toContain('note: tsconfig.json is not plain JSON: `ddd-ts-kit sdk` left it as it is.');
    expect(notes).toContain("note: pnpm-workspace.yaml lists its own packages: add 'clients/*' to them");
    expect(read(root, 'pnpm-workspace.yaml')).toBe('packages:\n  - tools/*\n');
  });
});
