import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
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
const KIT_LINES = '# Lines of ddd-ts-kit init: the lines of the team, below, have the last word.';

/** Whether git ignores the path, as the project's .gitignore says. */
const ignored = (root: string, file: string): boolean =>
  spawnSync('git', ['check-ignore', '--quiet', '--no-index', file], { cwd: root }).status === 0;

describe('init --force on a project that is already initialised', () => {
  it('rewrites the files and keeps what the team declared: the contexts and their upstreams, the rules, the limits, a key the kit does not know, the entry point', () => {
    const root = workedOn();
    const before = readJson(root, CONFIG);

    write(root, 'src/main.ts', '// mine\n');

    commitAll(root);
    const forced = cli(root, 'init', '--force');

    expect(forced.stderr).toBe('');
    expect(forced.stdout).toContain('wired the declared contexts again (billing, shipping, order-fulfilment)');
    expect(read(root, 'src/main.ts')).toBe('// mine\n');
    expect(forced.stdout).toContain('kept         src/main.ts (yours since the first init)');
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

    // Kept as the team wrote it, and named by check: nothing reads it.
    expect(
      checkJsonOf(cli(root, 'check', '--rule', 'config/valid', '--json')).violations.map(({ message }) => message),
    ).toEqual(['"team" is not a key of ddd-ts-kit.config.json: nothing reads it.']);
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

    // The grants the generators wrote stayed in the roles of the platform; config/valid names the key the team wrote that nothing reads.
    expect(
      [...new Set(checkJsonOf(cli(root, 'check', '--json')).violations.map(({ ruleId }) => ruleId))].sort(),
    ).toEqual(['config/valid']);
  });

  it('moves the declarations to the other spelling when asked, and leaves the imports of the contexts to the rule and its fix', () => {
    const root = workedOn('--import-extension', 'js');

    commitAll(root);
    expect(cli(root, 'init', '--force', '--import-extension', 'none').stderr).toBe('');

    const found = checkJsonOf(cli(root, 'check', '--json')).violations;

    expect(config(root, 'importExtension')).toBe('none');
    expect(jsonAt(readJson(root, 'tsconfig.json'), 'compilerOptions', 'moduleResolution')).toBe('Bundler');
    // The entry point is the team's once written: it keeps its imports, which the rule reports.
    expect(read(root, 'src/main.ts')).toContain("from '@/platform/composition/compose-application.js';");
    expect(found.length).toBeGreaterThan(50);

    expect([...new Set(found.map(({ ruleId }) => ruleId))].sort()).toEqual(['config/valid', 'imports/extension']);

    // What init does not write, or keeps, keeps its imports: the contexts, the entry points and the specs generators wrote.
    const keptImports = found.filter(({ ruleId }) => ruleId === 'imports/extension');

    expect([...new Set(keptImports.map(({ file }) => file.split('/').slice(0, 2).join('/')))].sort()).toEqual([
      'src/apps',
      'src/contexts',
      'src/main.ts',
      'src/platform',
      'test/acceptance',
      'test/architecture',
      'test/e2e',
    ]);

    expect(found.filter(({ file }) => file.startsWith('src/platform/')).map(({ file }) => file)).toEqual(
      expect.arrayContaining(['src/platform/resilience/own-policy.ts']),
    );

    expect(keptImports[0]?.fix).toContain('`eslint --fix` rewrites it');
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

describe('init --force and the files of the team', () => {
  it('keeps the lines of the team in .gitignore and .dockerignore, after the lines of the kit they lack: the team has the last word', () => {
    const root = initProject();

    write(root, '.gitignore', 'secret.env\n*.pem\n');
    write(root, '.dockerignore', 'node_modules\nfixtures\n');
    commitAll(root);

    const forced = cli(root, 'init', '--force');

    expect(forced.code).toBe(0);
    expect(read(root, '.gitignore')).toMatch(new RegExp(`^${KIT_LINES}\\nnode_modules\\ndist\\n`));
    expect(read(root, '.gitignore')).toContain('\n.worktrees/\n');
    expect(read(root, '.gitignore')).toMatch(/\nsecret\.env\n\*\.pem\n$/);
    expect(read(root, '.dockerignore')).toMatch(new RegExp(`^${KIT_LINES}\\ndist\\n`));
    expect(read(root, '.dockerignore')).toMatch(/\nnode_modules\nfixtures\n$/);
    expect(read(root, '.dockerignore').match(/^node_modules$/gm)).toHaveLength(1);
  });

  it('leaves a negation of the team its effect over a broader line of the kit', () => {
    const root = initProject();

    write(root, '.gitignore', 'dist/*\n!dist/.gitkeep\n');
    write(root, 'dist/.gitkeep', '');
    commitAll(root);

    expect(cli(root, 'init', '--force').code).toBe(0);
    expect(ignored(root, 'dist/.gitkeep')).toBe(false);
    expect(ignored(root, 'dist/main.js')).toBe(true);
  });

  it('adds .worktrees/ before the lines of the team on a plain init too', () => {
    const root = initProject();

    write(root, '.gitignore', 'secret.env\n');

    expect(cli(root, 'init').code).toBe(0);
    expect(read(root, '.gitignore')).toBe(`${KIT_LINES}\n.worktrees/\nsecret.env\n`);
  });

  it('leaves the README, the guides of the agents, the entry point and the pipeline to the team, lists them as kept, and says what it rewrote', () => {
    const root = initProject('--ci', 'github');
    const kept = ['.github/workflows/ci.yml', 'AGENTS.md', 'CLAUDE.md', 'README.md', 'src/main.ts'];

    for (const file of kept) {
      write(root, file, `${read(root, file)}\n# the team wrote this\n`);
    }

    write(root, 'biome.json', '{}\n');
    commitAll(root);

    const forced = cli(root, 'init', '--force');

    expect(forced.code).toBe(0);

    for (const file of kept) {
      expect(read(root, file)).toContain('# the team wrote this');
      expect(forced.stdout).toContain(`kept         ${file} (yours since the first init)`);
    }

    expect(read(root, 'biome.json')).not.toBe('{}\n');
    expect(forced.stdout).toContain('updated      biome.json');

    expect(forced.stdout).toMatch(
      /note: --force rewrote \d+ file\(s\) from the templates of this version \(listed as updated; git diff shows each change; \.gitignore and \.dockerignore only gain the lines of the kit they lack\), and kept \d+ file\(s\) yours since the first init \(listed as kept\): to take what this version writes in one of them, run init in an empty folder and compare\. \.github\/workflows\/ci\.yml, [^\n]*: their jobs and includes are yours to edit, those of --ci-extras too\./,
    );
  });

  it('says of a file of the team that init leaves that it is yours, with no advice of --force', () => {
    const root = initProject();
    const again = cli(root, 'init').stdout;

    expect(again).toContain('skipped      README.md (exists, kept (yours since the first init))');
    expect(again).toContain('skipped      src/main.ts (exists, kept (yours since the first init))');
    expect(again).toContain('skipped      biome.json (exists, kept; --force replaces it once it is committed)');
    expect(again).not.toContain('kept         README.md');
  });

  it('writes a file of the team again when it is gone', () => {
    const root = initProject();

    fs.rmSync(path.join(root, 'README.md'));
    commitAll(root);

    expect(cli(root, 'init', '--force').stdout).toContain('created      README.md');
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
