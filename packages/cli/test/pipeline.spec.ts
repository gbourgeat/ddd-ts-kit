import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cruiseConfiguration } from '../src/depcruise/configuration.js';
import { parseConfig } from '../src/config.js';
import { cli, exists, read, REPO_ROOT, scaffoldEverything, tempDir, write } from './helpers.js';

const PIPELINE = path.join(REPO_ROOT, 'pipeline');
const TEMPLATES = path.join(REPO_ROOT, 'packages/cli/templates/pipeline');
const source = (file: string): string => fs.readFileSync(path.join(PIPELINE, file), 'utf8');
const template = (file: string): string => fs.readFileSync(path.join(TEMPLATES, file), 'utf8');

/**
 * The CLI ships its own copy of the pipeline assets so that the published package is
 * self-contained. These tests are what keeps a copy from drifting: a template equals its
 * source, or its source with the differences written here.
 */
describe('pipeline templates', () => {
  it.each([
    ['lefthook.yml', 'lefthook.yml'],
    ['commitlint.config.mjs', 'commitlint.config.mjs'],
    ['renovate.json', 'renovate.json'],
    ['package-scripts.json', 'package-scripts.json'],
    ['github/workflows/ci.yml', 'github/workflows/ci.yml'],
    ['github/workflows/codeql.yml', 'github/workflows/codeql.yml'],
    ['github/workflows/pr-title.yml', 'github/workflows/pr-title.yml'],
    ['github/dependabot.yml', 'github/dependabot.yml'],
    ['github/branch-protection.md', 'github/branch-protection.md'],
    ['gitlab/merge-request-settings.md', 'gitlab/merge-request-settings.md'],
  ])('%s is the source, byte for byte', (file, copy) => {
    expect(template(copy)).toBe(source(file));
  });

  it('the GitLab pipeline differs only by the architecture report, which the checker now writes itself', () => {
    const expected = source('gitlab/.gitlab-ci.yml').replace(
      '    - npm run --silent ci:arch:check -- --format json > reports/arch.json || true\n    - node .gitlab/arch-to-codequality.mjs reports/arch.json reports/gl-code-quality-arch.json\n',
      '    - npm run --silent ci:arch:check -- --format gitlab > reports/gl-code-quality-arch.json\n',
    );

    expect(expected).not.toBe(source('gitlab/.gitlab-ci.yml'));
    expect(template('gitlab/gitlab-ci.yml')).toBe(expected);
  });

  it('the vitest config differs by the placeholders of the source root, the contexts directory and the alias, and by the architecture specs it runs', () => {
    // The proof that each context wires alone lives in test/architecture, outside the source root.
    const rendered = template('vitest.config.ts.tpl').replace(", 'test/architecture/**/*.spec.ts'", '').replaceAll('{{config.contextsDir}}', 'src/contexts').replaceAll('{{config.sourceRoot}}', 'src').replaceAll('{{alias.bare}}', '@');

    expect(rendered).toBe(source('vitest.config.ts'));
  });

  it('the ESLint config differs only for Prisma, whose generated client is not linted', () => {
    const root = tempDir('pipeline');
    cli(root, 'init');
    const prisma = tempDir('pipeline');
    cli(prisma, 'init', '--orm', 'prisma');

    expect(read(root, 'eslint.config.mjs')).toBe(source('eslint.config.mjs'));
    expect(read(prisma, 'eslint.config.mjs')).toContain("ignores: ['generated/**']");
  });

  it('the knip config differs by the fakes kept as entry points and by what the stack does not have', () => {
    const root = tempDir('pipeline');
    cli(root, 'init', '--ci', 'gitlab');
    const expected: { entry: string[] } = JSON.parse(source('knip.json')) as { entry: string[] };
    // A fake is test support kept ready for the specs to come: with it, the port it implements is in use.
    expected.entry.splice(2, 0, 'src/contexts/*/test/fakes/*.ts');
    const generated = JSON.parse(read(root, 'knip.json')) as { vitest: { entry: string[] } };
    // The proof that each context wires alone is a spec outside the source root.
    expect(generated.vitest.entry.splice(1, 1)).toEqual(['test/architecture/**/*.spec.ts']);

    expect(generated).toEqual(expected);
  });

  it('carries every script and every analyzer of the pipeline into package.json', () => {
    const root = tempDir('pipeline');
    cli(root, 'init', '--ci', 'both');
    const shipped = JSON.parse(source('package-scripts.json')) as { scripts: Record<string, string>; devDependencies: Record<string, string> };
    const manifest = JSON.parse(read(root, 'package.json')) as { scripts: Record<string, string>; devDependencies: Record<string, string> };

    // The import graph is cruised with the file the CLI generates from the config, after checking that it is current.
    expect(manifest.scripts).toMatchObject({ ...shipped.scripts, 'ci:arch:graph': 'npm run depcruise' });
    expect(manifest.devDependencies).toMatchObject(shipped.devDependencies);
  });
});

describe('init --ci', () => {
  const GITHUB = ['.github/workflows/ci.yml', '.github/workflows/codeql.yml', '.github/workflows/pr-title.yml', '.github/dependabot.yml', '.github/branch-protection.md'];
  const GITLAB = ['.gitlab-ci.yml', '.gitlab/merge-request-settings.md'];
  const ALWAYS = ['eslint.config.mjs', '.dependency-cruiser.cjs', 'knip.json', 'lefthook.yml', 'commitlint.config.mjs', 'vitest.config.ts'];

  it.each([
    ['github', GITHUB, GITLAB],
    ['gitlab', GITLAB, GITHUB],
    ['both', [...GITHUB, ...GITLAB], []],
    ['none', [], [...GITHUB, ...GITLAB, 'renovate.json']],
  ])('%s installs its pipeline and nothing of the other', (ci, present, absent) => {
    const root = tempDir('ci');
    cli(root, 'init', '--ci', ci);

    for (const file of [...ALWAYS, ...present]) expect(exists(root, file), file).toBe(true);
    for (const file of absent) expect(exists(root, file), file).toBe(false);
    expect(exists(root, 'renovate.json')).toBe(ci !== 'none');
    const manifest = JSON.parse(read(root, 'package.json')) as { devDependencies: Record<string, string> };
    expect(manifest.devDependencies['eslint-formatter-gitlab'] !== undefined).toBe(ci === 'gitlab' || ci === 'both');
    expect(read(root, 'knip.json').includes('eslint-formatter-gitlab')).toBe(ci === 'gitlab' || ci === 'both');
    expect(JSON.parse(read(root, 'ddd-ts-kit.config.json'))).toMatchObject({ stack: { ci, docsUi: 'swagger' } });
  });

  it('defaults to GitHub and stores the documentation page chosen', () => {
    const root = tempDir('ci');
    cli(root, 'init', '--docs-ui', 'redoc');

    expect(JSON.parse(read(root, 'ddd-ts-kit.config.json'))).toMatchObject({ stack: { ci: 'github', docsUi: 'redoc' } });
    expect(read(root, '.github/workflows/ci.yml')).toContain('npm run ci:arch:check -- --format github');
  });

  it('gives the coverage thresholds of each layer to vitest', () => {
    const root = tempDir('ci');
    cli(root, 'init');
    const config = read(root, 'vitest.config.ts');

    expect(config).toContain("[layer('domain')]: { statements: 90, branches: 85, functions: 90, lines: 90 }");
    expect(config).toContain("[layer('infrastructure')]: { statements: 70, branches: 60, functions: 70, lines: 70 }");
  });
});

describe('agent settings', () => {
  interface Settings {
    permissions: { allow: string[]; deny: string[]; ask: string[] };
    [key: string]: unknown;
  }
  const settings = (root: string): Settings => JSON.parse(read(root, '.claude/settings.json')) as Settings;

  it('holds permissions only: what runs without asking, what never happens, what is asked', () => {
    const root = tempDir('settings');
    cli(root, 'init');
    const { permissions, ...rest } = settings(root);

    expect(rest).toEqual({});
    expect(Object.keys(permissions)).toEqual(['allow', 'deny', 'ask']);
    expect(permissions.allow).toEqual(
      expect.arrayContaining(['Bash(npx ddd-ts-kit check *)', 'Bash(npx ddd-ts-kit generate *)', 'Bash(npx ddd-ts-kit rules)', 'Bash(npm run verify)', 'Bash(npm run lint *)', 'Bash(npm test *)', 'Bash(npm run docs:check)', 'Bash(npm run events:check)']),
    );
    expect(permissions.allow).toHaveLength(17);
    expect(permissions.deny).toEqual([
      'Read(./.env)',
      'Read(./.env.*)',
      'Read(!./.env.example)',
      'Edit(./openapi/openapi.json)',
      'Edit(./docs/integration/asyncapi.json)',
      'Edit(./docs/integration/event-catalog.md)',
    ]);
    expect(permissions.ask).toEqual([
      'Bash(git push *)',
      'Bash(npm publish *)',
      'Edit(./ddd-ts-kit.config.json)',
      'Edit(./eslint.config.mjs)',
      'Edit(./.dependency-cruiser.cjs)',
      'Edit(./knip.json)',
      'Edit(./lefthook.yml)',
      'Edit(./.gitlab-ci.yml)',
      'Edit(./.github/workflows/**)',
      'Edit(./.claude/settings.json)',
    ]);
  });

  it('keeps the settings a project already has, adds what is missing and says what', () => {
    const root = tempDir('settings');
    write(root, '.claude/settings.json', JSON.stringify({ model: 'a-model', permissions: { allow: ['Bash(make *)', 'Bash(npm run verify)'], deny: ['Read(./secrets/**)'] } }));

    const report = cli(root, 'init', '--json').json() as { updated: string[]; skipped: string[]; notes: string[] };
    const merged = settings(root);

    expect(report.updated).toContain('.claude/settings.json');
    expect(merged['model']).toBe('a-model');
    expect(merged.permissions.allow.slice(0, 2)).toEqual(['Bash(make *)', 'Bash(npm run verify)']);
    expect(merged.permissions.allow.filter((rule) => rule === 'Bash(npm run verify)')).toHaveLength(1);
    expect(merged.permissions.deny[0]).toBe('Read(./secrets/**)');
    expect(merged.permissions.deny).toContain('Edit(./openapi/openapi.json)');
    expect(report.notes.join('\n')).toMatch(/\.claude\/settings\.json gained 32 permission\(s\): allow Bash\(npx ddd-ts-kit check \*\)/);

    const again = cli(root, 'init', '--json').json() as { updated: string[] };
    expect(again.updated).not.toContain('.claude/settings.json');
  });

  it('leaves alone a settings file it cannot read', () => {
    const root = tempDir('settings');
    write(root, '.claude/settings.json', '{ not json');

    const report = cli(root, 'init', '--json').json() as { notes: string[] };

    expect(read(root, '.claude/settings.json')).toBe('{ not json');
    expect(report.notes.join('\n')).toContain('is not a JSON object');
  });
});

describe('depcruise-config', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('depcruise');
    scaffoldEverything(root);
  });

  it('is generated by init and kept current by generate', () => {
    expect(cli(root, 'depcruise-config', '--check').stdout).toBe('.dependency-cruiser.cjs is up to date.');
    const file = read(root, '.dependency-cruiser.cjs');
    expect(file.startsWith('// Generated by `ddd-ts-kit depcruise-config`')).toBe(true);
    expect(file).toContain('"shipping\\" imports the published language of a context that is not one of its upstreams');
    expect(file).toContain('^src/contexts/(shipping|billing)/');
  });

  it('prints the configuration, reports a stale file and writes it again', () => {
    const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as { contexts: Record<string, { upstreams: unknown[] }> };
    config.contexts['order-fulfilment']?.upstreams.push({ context: 'billing', relationship: 'conformist' });
    write(root, 'ddd-ts-kit.config.json', JSON.stringify(config, null, 2));

    const stale = cli(root, 'depcruise-config', '--check');
    expect(stale.code).toBe(1);
    expect(stale.stdout).toContain('stale  .dependency-cruiser.cjs');
    expect(cli(root, 'depcruise-config', '--check', '--json').json()).toEqual({ ok: false, file: '.dependency-cruiser.cjs' });
    expect(cli(root, 'depcruise-config').stdout).toContain('^src/contexts/(order-fulfilment|billing)/');

    expect(cli(root, 'depcruise-config', '--write').stdout).toBe('written  .dependency-cruiser.cjs');
    expect(cli(root, 'depcruise-config', '--check').code).toBe(0);
    expect(`${cli(root, 'depcruise-config').stdout}\n`).toBe(read(root, '.dependency-cruiser.cjs'));
  });

  describe('against the script of the pipeline', () => {
    // Next to the tests so that the script resolves `typescript` like a project would.
    const sandbox = path.join(REPO_ROOT, 'packages/cli/test', `.depcruise-${process.pid}`);
    const projectConfig = {
      sourceRoot: 'app',
      contextsDir: 'app/contexts',
      stack: { validation: 'class-validator' },
      contexts: { billing: { classification: 'core', upstreams: [] }, 'order-fulfilment': { classification: 'generic', upstreams: [{ context: 'billing' }, 'catalog'] }, catalog: { classification: 'generic' } },
      domainAllowedPackages: ['@ddd-ts-kit/kernel', 'decimal.js'],
      // Written out, as `init` does: the shipped script does not know that the application layer may import the auth package by default.
      applicationAllowedPackages: ['@ddd-ts-kit/kernel', '@ddd-ts-kit/auth'],
    };

    beforeAll(() => {
      fs.mkdirSync(sandbox, { recursive: true });
      fs.copyFileSync(path.join(PIPELINE, 'depcruise-config.mjs'), path.join(sandbox, 'depcruise-config.mjs'));
      fs.writeFileSync(path.join(sandbox, 'ddd-ts-kit.config.json'), JSON.stringify(projectConfig));
    });

    afterAll(() => {
      fs.rmSync(sandbox, { recursive: true, force: true });
    });

    it('builds the same rules and options, plus the fakes and the entry points of single contexts among the files that may have no importer', async () => {
      const shipped = ((await import(pathToFileURL(path.join(sandbox, 'depcruise-config.mjs')).href)) as { default: unknown }).default;
      const ported = JSON.parse(JSON.stringify(cruiseConfiguration(parseConfig(projectConfig)))) as { forbidden: { name: string; from: { pathNot: string[] } }[] };
      const orphans = ported.forbidden.find((rule) => rule.name === 'no-orphans');
      // An entry point of a context run alone has no importer either.
      const added = [...(orphans?.from.pathNot.splice(1, 1) ?? []), ...(orphans?.from.pathNot.splice(3, 1) ?? [])];

      expect(added).toEqual(['^app/apps/[^/]+/main\\.ts$', '^app/contexts/[^/]+/test/fakes/']);
      // The shipped script anchors tracing.ts under the source root; the port follows `platformDir`, the same place by default.
      expect(ported).toEqual(JSON.parse(JSON.stringify(shipped)));
    });
  });
});

describe('check --format gitlab', () => {
  it('prints the Code Quality report the converter of the pipeline would write, fingerprints included', () => {
    const root = tempDir('gitlab');
    scaffoldEverything(root);
    const aggregate = 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts';
    write(root, aggregate, `import { z } from 'zod';\nimport { v4 } from 'uuid';\n${read(root, aggregate)}\nexport const shapes = [z, v4, z];\n// const old = 1;\n`);
    write(root, 'src/contexts/billing/domain/aggregates/Wrong.ts', 'export class Wrong {}\n');

    const direct = cli(root, 'check', '--format', 'gitlab');
    write(root, 'reports/arch.json', cli(root, 'check', '--format', 'json').stdout);
    try {
      execFileSync(process.execPath, [path.join(PIPELINE, 'gitlab/arch-to-codequality.mjs'), 'reports/arch.json', 'reports/converted.json'], { cwd: root, stdio: 'pipe' });
    } catch {
      // The converter exits 1 while errors remain; the report is written all the same.
    }
    const issues = direct.json() as { fingerprint: string; severity: string; check_name: string; location: { path: string; lines: { begin: number } } }[];

    expect(direct.code).toBe(1);
    expect(issues.length).toBeGreaterThan(4);
    expect(issues).toEqual(JSON.parse(read(root, 'reports/converted.json')));
    expect(new Set(issues.map((issue) => issue.fingerprint)).size).toBe(issues.length);
    expect(issues.find((issue) => issue.check_name === 'layer/domain-purity')).toMatchObject({ severity: 'major', location: { path: aggregate, lines: { begin: 1 } } });
  });

  it('prints an empty report for a clean project', () => {
    const root = tempDir('gitlab');
    scaffoldEverything(root);

    expect(cli(root, 'check', '--format', 'gitlab').json()).toEqual([]);
  });
});
