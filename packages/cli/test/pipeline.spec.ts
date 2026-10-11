import { describe, expect, it } from 'vitest';
import { exists, read } from './helpers.js';
import { initProject } from './support/init-project.js';
import { jsonAt } from './support/json-at.js';
import { keysAt } from './support/keys-at.js';
import { pipelineAsset } from './support/pipeline-asset.js';
import { readJson } from './support/read-json.js';
import { stringsAt } from './support/strings-at.js';
import { textsAt } from './support/texts-at.js';

const source = (file: string): string => pipelineAsset('source', file);
const template = (file: string): string => pipelineAsset('template', file);

/** Without the architecture specs the unit project of the source is shorter: the formatter lays it out on fewer lines. */
/** What a template adds for one package manager or one ORM, between its tags. */
const OPTIONAL_STEPS = /\{\{#if (?:pm\.corepack|orm\.prisma)\}\}\n[\s\S]*?\{\{\/if\}\}\n/g;

const UNIT_PROJECT_OF_THE_SOURCE =
  "{\n        extends: true,\n        test: { name: 'unit', include: ['src/**/*.spec.ts'], exclude: [INTEGRATION_SPECS, ...NOT_AFFECTED] },\n      },";

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
    ['github/scripts/start-postgres.sh', 'github/scripts/start-postgres.sh'],
    ['github/workflows/codeql.yml', 'github/workflows/codeql.yml'],
    ['github/workflows/pr-title.yml', 'github/workflows/pr-title.yml'],
    ['github/dependabot.yml', 'github/dependabot.yml'],
    ['github/branch-protection.md', 'github/branch-protection.md'],
    ['gitlab/merge-request-settings.md', 'gitlab/merge-request-settings.md'],
  ])('%s is the source, byte for byte', (file, copy) => {
    expect(template(copy)).toBe(source(file));
  });

  it('the setup action of the GitHub pipeline is the source, plus the step that asks corepack for pnpm and the one that generates the Prisma client', () => {
    expect(template('github/actions/setup/action.yml.tpl').replaceAll(OPTIONAL_STEPS, '')).toBe(
      source('github/actions/setup/action.yml'),
    );

    expect(read(initProject('--package-manager', 'npm'), '.github/actions/setup/action.yml')).toBe(
      source('github/actions/setup/action.yml'),
    );

    expect(read(initProject('--orm', 'prisma'), '.github/actions/setup/action.yml')).toContain(
      'run: pnpm run db:client',
    );
  });

  it('the GitLab pipeline differs only by the architecture report, which the checker now writes itself, by the line that asks corepack for pnpm and by the one that generates the Prisma client', () => {
    const expected = source('gitlab/.gitlab-ci.yml').replace(
      '    - npm run --silent ci:arch:check -- --format json > reports/arch.json || true\n    - node .gitlab/arch-to-codequality.mjs reports/arch.json reports/gl-code-quality-arch.json\n',
      '    - npm run --silent ci:arch:check -- --format gitlab > reports/gl-code-quality-arch.json\n',
    );

    expect(expected).not.toBe(source('gitlab/.gitlab-ci.yml'));
    expect(template('gitlab/gitlab-ci.yml.tpl').replaceAll(OPTIONAL_STEPS, '')).toBe(expected);
    expect(read(initProject('--package-manager', 'npm', '--ci', 'gitlab'), '.gitlab-ci.yml')).toBe(expected);

    expect(read(initProject('--orm', 'prisma', '--ci', 'gitlab'), '.gitlab-ci.yml')).toContain(
      '    - test -d node_modules || pnpm install --frozen-lockfile\n    # The Prisma client and the schema of the tests are build products of prisma/schema.prisma.\n    - pnpm run db:client\n',
    );
  });

  it('the vitest config differs by the placeholders of the source root and the contexts directory, by the architecture specs it runs, by the decorators plugin, which is written for the standard decorator mode only, by the coverage plugin of the legacy mode, and by the inlined package under discovery', () => {
    // The proof that each context wires alone lives in test/architecture, outside the source root.
    const rendered = template('vitest.config.ts.tpl')
      .replaceAll(/^[ \t]*\{\{#if (?:assembly\.discovery|decorators\.legacy)\}\}\n[\s\S]*?^[ \t]*\{\{\/if\}\}\n/gm, '')
      .replaceAll(/^[ \t]*\{\{(?:#if decorators\.standard|\/if)\}\}\n/gm, '')
      .replace(", 'test/architecture/**/*.spec.ts'", '')
      .replaceAll('{{config.contextsDir}}', 'src/contexts')
      .replaceAll('{{config.sourceRoot}}', 'src')
      // With the architecture specs the unit project no longer fits one line: the formatter gives it several.
      .replace(
        "{\n        extends: true,\n        test: {\n          name: 'unit',\n          include: ['src/**/*.spec.ts'],\n          exclude: [INTEGRATION_SPECS, ...NOT_AFFECTED],\n        },\n      },",
        UNIT_PROJECT_OF_THE_SOURCE,
      );

    expect(rendered).toBe(source('vitest.config.ts'));
  });

  it('a project compiled with experimentalDecorators gets a vitest config without the compiling plugin: the runner lowers legacy decorators itself, and what it writes to apply them is kept out of the coverage measure', () => {
    const standard = initProject();
    const legacy = initProject('--validation', 'class-validator');
    const plugin = "plugins: [decorators({ compiler: '@typescript/native' })]";

    expect(read(standard, 'vitest.config.ts')).toContain(plugin);
    expect(read(standard, 'vitest.e2e.config.ts')).toContain(plugin);
    expect(read(legacy, 'vitest.config.ts')).not.toContain('decorators(');
    expect(read(legacy, 'vitest.config.ts')).toContain('plugins: [decoratorCoverage()]');
    expect(read(standard, 'vitest.config.ts')).not.toContain('decoratorCoverage');
    expect(read(legacy, 'vitest.e2e.config.ts')).not.toContain('decorators');
    expect(readJson(legacy, 'tsconfig.json')).toMatchObject({ compilerOptions: { experimentalDecorators: true } });
    expect(jsonAt(readJson(standard, 'tsconfig.json'), 'compilerOptions')).not.toHaveProperty('experimentalDecorators');
  });

  it('the ESLint config is the preset of the plugin, and differs only for Prisma, whose generated client is not linted', () => {
    expect(read(initProject(), 'eslint.config.mjs')).toBe(source('eslint.config.mjs'));
    expect(read(initProject('--orm', 'prisma'), 'eslint.config.mjs')).toContain("ignores: ['generated/**']");
  });

  it('carries every script and every analyzer of the pipeline into package.json', () => {
    const manifest = readJson(initProject('--ci', 'both', '--package-manager', 'npm'), 'package.json');
    const shipped: unknown = JSON.parse(source('package-scripts.json'));

    // The import graph is cruised with the file the CLI generates from the config, after checking that it is current.
    // The documents are compared from the build the step before made: the pipeline of a project builds once.
    expect(textsAt(manifest, 'scripts')).toMatchObject({
      ...textsAt(shipped, 'scripts'),
      'ci:arch:graph': 'npm run depcruise',
      'ci:docs':
        'ddd-ts-kit docs --check && node dist/scripts/openapi.js --check && node dist/scripts/events.js --check',
    });

    expect(textsAt(manifest, 'devDependencies')).toMatchObject(textsAt(shipped, 'devDependencies'));
  });
});

describe('the knip config init writes', () => {
  const entries = (root: string): string[] => stringsAt(readJson(root, 'knip.json'), 'entry');

  it('of an explicit project differs from the source by the fakes kept as entry points and by what the stack does not have', () => {
    const generated = readJson(initProject('--ci', 'gitlab', '--style', 'explicit'), 'knip.json');
    const expected: unknown = JSON.parse(source('knip.json'));
    const fakes = 'src/contexts/*/test/fakes/*.ts';

    // A fake is test support kept ready for the specs to come: with it, the port it implements is in use.
    expect(stringsAt(generated, 'entry')).toEqual(stringsAt(expected, 'entry').toSpliced(2, 0, fakes));

    // The proof that each context wires alone is a spec outside the source root.
    expect(stringsAt(generated, 'vitest', 'entry')).toEqual(
      stringsAt(expected, 'vitest', 'entry').toSpliced(1, 0, 'test/architecture/**/*.spec.ts'),
    );

    for (const key of ['$schema', 'project', 'ignoreDependencies', 'ignoreExportsUsedInFile']) {
      expect(jsonAt(generated, key), key).toEqual(jsonAt(expected, key));
    }

    expect(jsonAt(generated, 'vitest', 'config')).toEqual(jsonAt(expected, 'vitest', 'config'));
    expect(keysAt(generated)).toEqual(keysAt(expected));
  });

  it('of a declared project has no module file to enter by: the barrel of each context is imported by the composition root', () => {
    const explicit = entries(initProject('--style', 'explicit'));

    expect(explicit).toContain('src/contexts/*/*.module.ts');
    expect(entries(initProject())).toEqual(explicit.filter((entry) => entry !== 'src/contexts/*/*.module.ts'));
  });

  it('enters by the role files under discovery, jobs and publishers included, with or without a broker', () => {
    const discovered =
      'src/contexts/*/{application,infrastructure}/**/*.{command,query,handler,integration-handler,event-handler,publisher,policy,job,repository,gateway,adapter}.ts';

    expect(entries(initProject('--assembly', 'discovery'))).toContain(discovered);
    expect(entries(initProject('--assembly', 'discovery', '--broker', 'kafka'))).toContain(discovered);
    expect(entries(initProject())).not.toContain(discovered);
  });
});

describe('init --ci', () => {
  const GITHUB = [
    '.github/workflows/ci.yml',
    '.github/workflows/codeql.yml',
    '.github/workflows/pr-title.yml',
    '.github/actions/setup/action.yml',
    '.github/scripts/start-postgres.sh',
    '.github/dependabot.yml',
    '.github/branch-protection.md',
  ];

  const GITLAB = ['.gitlab-ci.yml', '.gitlab/merge-request-settings.md'];

  const ALWAYS = [
    'eslint.config.mjs',
    '.dependency-cruiser.cjs',
    'knip.json',
    'lefthook.yml',
    'commitlint.config.mjs',
    'vitest.config.ts',
  ];

  it.each([
    ['github', GITHUB, GITLAB],
    ['gitlab', GITLAB, GITHUB],
    ['both', [...GITHUB, ...GITLAB], []],
    ['none', [], [...GITHUB, ...GITLAB, 'renovate.json']],
  ])('%s installs its pipeline and nothing of the other', (ci, present, absent) => {
    const root = initProject('--ci', ci);
    const usesGitlab = ci === 'gitlab' || ci === 'both';

    for (const file of [...ALWAYS, ...present]) {
      expect(exists(root, file), file).toBe(true);
    }

    for (const file of absent) {
      expect(exists(root, file), file).toBe(false);
    }

    expect(exists(root, 'renovate.json')).toBe(ci !== 'none');
    expect('eslint-formatter-gitlab' in textsAt(readJson(root, 'package.json'), 'devDependencies')).toBe(usesGitlab);
    expect(read(root, 'knip.json').includes('eslint-formatter-gitlab')).toBe(usesGitlab);
    expect(readJson(root, 'ddd-ts-kit.config.json')).toMatchObject({ stack: { ci, docsUi: 'swagger' } });
  });

  it('defaults to GitHub and stores the documentation page chosen', () => {
    const root = initProject('--docs-ui', 'redoc', '--package-manager', 'npm');

    expect(readJson(root, 'ddd-ts-kit.config.json')).toMatchObject({ stack: { ci: 'github', docsUi: 'redoc' } });
    expect(read(root, '.github/workflows/ci.yml')).toContain('npm run ci:arch:check -- --format github');
  });

  it('writes no threshold in the runner config: vitest and jest read them from the config file', () => {
    const vitest = read(initProject(), 'vitest.config.ts');
    const jest = read(initProject('--tests', 'jest'), 'jest.config.js');

    expect(vitest).toContain("import { governedCoverage, unaffectedContexts } from '@ddd-ts-kit/testing/coverage';");
    expect(vitest).toContain('...governedCoverage(mode),');
    expect(jest).toContain('...governedJestCoverage(),');

    for (const config of [vitest, jest]) {
      expect(config).not.toMatch(/statements|thresholds|coverageThreshold:|exclude: \['.*(domain|infrastructure)/);
    }
  });
});
