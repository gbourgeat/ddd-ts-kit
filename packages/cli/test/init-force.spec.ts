import { describe, expect, it } from 'vitest';
import { changeConfig, checkJsonOf } from './check-support';
import { cli, DEFAULT_STACK, read, scaffoldEverything, tempDir, write } from './helpers';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';
import { readJson } from './support/read-json';
import { toEarlierPlaces } from './support/to-earlier-places';
import { VERSION } from '../src/version';
import { commitAll } from './support/commit-all';

const CONFIG = 'ddd-ts-kit.config.json';
const COMPOSITION = 'src/platform/composition/compose-application.ts';
const config = (root: string, ...keys: string[]): unknown => jsonAt(readJson(root, CONFIG), ...keys);

describe('init --force on a project that is already initialised', () => {
  it('rewrites the files and keeps what the team declared: the contexts and their upstreams, the rules, the limits, a key the kit does not know', () => {
    const root = workedOn();
    const before = readJson(root, CONFIG);

    write(root, 'src/main.ts', '// mine\n');

    commitAll(root);
    const forced = cli(root, 'init', '--force');

    expect(forced.stderr).toBe('');
    expect(forced.stdout).toContain('wired the declared contexts again (billing, shipping, order-fulfilment)');
    expect(read(root, 'src/main.ts')).toContain('composeApplication');
    expect(read(root, COMPOSITION)).toContain("contextModule('billing', billingDeclarations),");

    expect(read(root, COMPOSITION)).toContain(
      "import * as shippingDeclarations from '@/contexts/shipping/shipping.declarations';",
    );

    expect(read(root, COMPOSITION)).not.toContain('shippingRoutes');

    expect(read(root, 'test/architecture/extractable.spec.ts')).toContain("['order-fulfilment', contextModule(");
    expect(readJson(root, CONFIG)).toEqual(before);
    expect(Object.keys(Object(config(root, 'contexts')))).toEqual(['billing', 'shipping', 'order-fulfilment']);

    expect(config(root, 'contexts', 'shipping', 'upstreams')).toEqual(
      jsonAt(before, 'contexts', 'shipping', 'upstreams'),
    );

    expect(config(root, 'deviations', '0', 'owner')).toBe('lead');
    expect(config(root, 'team')).toBe('payments');
    expect(config(root, 'worker')).toBe(true);
    expect(Object.keys(Object(readJson(root, CONFIG)))).toEqual(Object.keys(Object(before)));
    expect(read(root, 'knip.json')).toContain('src/contexts/*/published-language/index.ts');
    expect(read(root, '.dependency-cruiser.cjs')).toContain('shipping');
    expect(checkJsonOf(cli(root, 'check', '--rule', 'config/valid', '--json')).violations).toEqual([]);
  });

  it('records the version that rewrote the files, first, over an older one or none', () => {
    const root = initProject();
    const { initVersion, ...written } = Object(readJson(root, CONFIG)) as Record<string, unknown>;

    expect(initVersion).toBe(VERSION);

    write(root, CONFIG, `${JSON.stringify({ ...written, initVersion: '0.1.0' }, null, 2)}\n`);
    commitAll(root);
    expect(cli(root, 'init', '--force').stderr).toBe('');
    expect(Object.keys(Object(readJson(root, CONFIG)))[0]).toBe('initVersion');
    expect(config(root, 'initVersion')).toBe(VERSION);

    write(root, CONFIG, `${JSON.stringify(written, null, 2)}\n`);
    commitAll(root);
    expect(cli(root, 'init', '--force').stderr).toBe('');
    expect(Object.keys(Object(readJson(root, CONFIG)))[0]).toBe('initVersion');
    expect(config(root, 'initVersion')).toBe(VERSION);
  });

  it('changes the choice a flag names and nothing else of the recorded stack', () => {
    const root = workedOn('--orm', 'knex', '--logger', 'pino', '--authz', 'rebac');
    const before = Object(config(root, 'stack')) as Record<string, unknown>;

    commitAll(root);
    expect(cli(root, 'init', '--force', '--docs-ui', 'scalar', '--cache', 'redis').stderr).toBe('');
    expect(config(root, 'stack')).toEqual({ ...before, docsUi: 'scalar', cache: 'redis' });
    expect(Object.keys(Object(config(root, 'contexts')))).toEqual(['billing', 'shipping', 'order-fulfilment']);
    expect(read(root, 'package.json')).toContain('"@ddd-ts-kit/redis"');

    // The registry of permissions was rewritten too: the set of each context that has one is listed in it again.
    expect(read(root, 'src/platform/auth/authorization/permissions.ts')).toContain(
      '\n  billingPermissions,\n  shippingPermissions,',
    );
  });

  it('wires the permission set of a context again where the project keeps it, as 0.86 and 0.87 wrote it', () => {
    const root = workedOn('--authz', 'rebac');

    toEarlierPlaces(root, ['billing', 'shipping']);
    commitAll(root);
    expect(cli(root, 'init', '--force').stderr).toBe('');

    const registry = read(root, 'src/platform/auth/authorization/permissions.ts');

    expect(registry).toContain('\n  billingPermissions,\n  shippingPermissions,');
    expect(registry).toContain("from '@/contexts/billing/application/authorization/billing.permissions';");
    expect(registry).not.toContain('@/contexts/billing/billing.permissions');

    // knip is told of the code lists where they are: at the root, and where 0.86 and 0.87 kept them.
    expect(Object.keys(Object(readJson(root, 'knip.json')).ignoreIssues ?? {})).toEqual([
      'src/contexts/*/*.codes.ts',
      'src/contexts/*/domain/errors/codes.ts',
    ]);
  });

  it('refuses a flag the recorded stack cannot take, as it would for a new project, and writes nothing', () => {
    const root = workedOn();
    const before = read(root, CONFIG);
    const refused = cli(root, 'init', '--force', '--http', 'nest');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('--http nest cannot be combined with --di tsyringe.');
    expect(read(root, CONFIG)).toBe(before);
  });

  it('does not ask again for the reason of a recorded run without the outbox', () => {
    const root = initProject('--events', 'in-memory', '--allow-no-outbox', 'One process, one database.');
    const deviations = config(root, 'deviations');

    commitAll(root);
    expect(cli(root, 'init', '--force').stderr).toBe('');
    expect(config(root, 'stack', 'events')).toBe('in-memory');
    expect(config(root, 'deviations')).toEqual(deviations);
  });

  it('keeps a way of publishing events that init does not offer and a team wrote by hand', () => {
    const root = initProject();

    changeConfig(root, { stack: { ...Object(config(root, 'stack')), events: 'custom' } });

    commitAll(root);
    expect(cli(root, 'init', '--force', '--logger', 'pino').stderr).toBe('');
    expect(config(root, 'stack', 'events')).toBe('custom');
    expect(config(root, 'stack', 'logger')).toBe('pino');
  });
});

describe('init --force and the spelling of the imports, the settings of the agent, a config it cannot read', () => {
  it('keeps the ".js" of a project written before "importExtension" existed, and says it in the config, next to the alias', () => {
    const root = workedOn('--import-extension', 'js');

    write(root, CONFIG, read(root, CONFIG).replace(/\n\s*"importExtension": "js",/, ''));

    commitAll(root);
    expect(cli(root, 'init', '--force').stderr).toBe('');
    expect(Object.keys(Object(readJson(root, CONFIG))).slice(5, 7)).toEqual(['importAlias', 'importExtension']);
    expect(config(root, 'importExtension')).toBe('js');
    expect(jsonAt(readJson(root, 'tsconfig.json'), 'compilerOptions', 'moduleResolution')).toBe('NodeNext');
    expect(read(root, 'src/main.ts')).toContain("from '@/platform/composition/compose-application.js';");

    // The roles of the platform are written from their template again: the grants the generators had added are gone, and said.
    expect([...new Set(checkJsonOf(cli(root, 'check', '--json')).violations.map(({ ruleId }) => ruleId))]).toEqual([
      'authz/granted',
    ]);
  });

  it('moves the declarations to the other spelling when asked, and leaves the imports of the contexts to the rule and its fix', () => {
    const root = workedOn('--import-extension', 'js');

    commitAll(root);
    expect(cli(root, 'init', '--force', '--import-extension', 'none').stderr).toBe('');

    const found = checkJsonOf(cli(root, 'check', '--json')).violations;

    expect(config(root, 'importExtension')).toBe('none');
    expect(jsonAt(readJson(root, 'tsconfig.json'), 'compilerOptions', 'moduleResolution')).toBe('Bundler');
    expect(read(root, 'src/main.ts')).toContain("from '@/platform/composition/compose-application';");
    expect(found.length).toBeGreaterThan(50);
    expect([...new Set(found.map(({ ruleId }) => ruleId))].sort()).toEqual(['authz/granted', 'imports/extension']);

    // What init does not write keeps its imports: the contexts, the entry points and the specs generators wrote.
    expect([...new Set(found.map(({ file }) => file.split('/').slice(0, 2).join('/')))].sort()).toEqual([
      'src/apps',
      'src/contexts',
      'src/platform',
      'test/acceptance',
      'test/architecture',
      'test/e2e',
    ]);

    expect(found.filter(({ file }) => file.startsWith('src/platform/')).map(({ file }) => file)).toEqual(
      expect.arrayContaining(['src/platform/resilience/own-policy.ts']),
    );

    expect(found[0]?.fix).toContain('`eslint --fix` rewrites it');
  });

  it('adds no permission twice to the settings of the agent when init runs again, on pnpm as on npm', () => {
    for (const manager of ['pnpm', 'npm']) {
      const root = initProject('--package-manager', manager);
      const settings = read(root, '.claude/settings.json');

      expect(cli(root, 'init').stdout).not.toContain('gained');
      commitAll(root);
      expect(cli(root, 'init', '--force').stdout).not.toContain('gained');
      expect(read(root, '.claude/settings.json')).toBe(settings);
    }
  });

  it('replaces a config it cannot read: there is nothing to keep', () => {
    const root = initProject();

    write(root, CONFIG, '{ not json');

    expect(cli(root, 'init').code).toBe(2);
    commitAll(root);
    expect(cli(root, 'init', '--force').stderr).toBe('');
    expect(config(root, 'contexts')).toEqual({});
    expect(config(root, 'importExtension')).toBe('none');
  });
});

/** A project a team has worked on: contexts with a relationship, and choices of its own in the config. */
function workedOn(...flags: string[]): string {
  const root = tempDir('force');

  scaffoldEverything(root, DEFAULT_STACK, flags);

  changeConfig(root, {
    rules: { 'clean/function-size': 'error' },
    limits: { maxParameters: 4, maxFunctionLines: 30 },
    guard: 'advise',
    publishedLanguageAllowedPackages: ['@ddd-ts-kit/kernel', '@ddd-ts-kit/events', '@ddd-ts-kit/validation', 'zod'],
    team: 'payments',
    deviations: [
      { what: 'rules.clean/function-size', adr: '0001', reason: 'Raised on purpose.', owner: 'lead' },
      { what: 'guard', adr: '0001', reason: 'Advisory while the team learns.' },
    ],
  });

  return root;
}
