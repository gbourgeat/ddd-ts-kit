import { describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir, walk, write } from './helpers';
import { initFailure } from './support/init-failure';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';
import { readJson } from './support/read-json';
import { stringsAt } from './support/strings-at';
import { textsAt } from './support/texts-at';
import { KIT_RANGE } from './support/kit-range';
import { VERSION } from '../src/version';

const BOOTSTRAPPED = [
  'ddd-ts-kit.config.json',
  'package.json',
  'tsconfig.json',
  'src/main.ts',
  'src/platform/observability/tracing.ts',
  'src/platform/composition/compose-application.ts',
  'src/platform/composition/platform.module.ts',
  'src/platform/composition/platform-test.module.ts',
  'src/platform/jobs/job-settings.ts',
  'src/platform/config/load-config.ts',
  'src/platform/http/start-http-server.ts',
  'scripts/openapi.ts',
  'src/shared-kernel/.gitkeep',
  '.github/workflows/ci.yml',
  'AGENTS.md',
  'CLAUDE.md',
  'REVIEW.md',
  '.claude/rules/domain.md',
  '.claude/rules/tests.md',
  'src/contexts/billing/CONTEXT.md',
  'src/contexts/billing/billing.declarations.ts',
  'src/contexts/billing/published-language/index.ts',
];

describe('init', () => {
  it('bootstraps an empty directory with the default stack', () => {
    const root = tempDir('init');

    const result = cli(root, 'init', '--context', 'billing:core', '--json');
    const created = stringsAt(result.json(), 'created');

    expect(result.code).toBe(0);
    expect(stringsAt(result.json(), 'skipped')).toEqual([]);
    expect(created).toEqual(expect.arrayContaining(BOOTSTRAPPED));
    expect(created).not.toContain('src/contexts/billing/billing.module.ts');
    expect(walk(root)).toEqual([...created].sort());
    expect(read(root, 'src/contexts/billing/billing.declarations.ts')).toBe('export {};\n');
    // Controllers declare themselves: nothing lists the routes of a declared context, and the composition root mounts what the contexts declare.
    expect(created).not.toContain('src/contexts/billing/presentation/http/billing.routes.ts');

    expect(read(root, 'src/platform/composition/compose-application.ts')).toContain(
      "controllerRoutes(container.resolve(DeclaredEdges).of('controller'), { resolve: container.resolve, security }),",
    );

    expect(read(root, 'src/platform/composition/compose-application.ts')).toContain(
      "contextModule('billing', billingDeclarations),",
    );
  });

  it('writes each context as a module file with --style explicit, and says so in the config', () => {
    const root = tempDir('init');

    const created = stringsAt(
      cli(root, 'init', '--style', 'explicit', '--context', 'billing:core', '--json').json(),
      'created',
    );

    const stack = jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'stack');

    expect(created).toContain('src/contexts/billing/billing.module.ts');
    expect(created).not.toContain('src/contexts/billing/billing.declarations.ts');
    expect(stack).toMatchObject({ style: 'explicit' });
    expect(stack).not.toHaveProperty('assembly');
    expect(read(root, 'src/platform/composition/compose-application.ts')).toContain('billingModule,');
  });

  it('keeps the declared style for the container that reads the declarations, and the barrel for the declared style', () => {
    expect(initFailure('--di', 'manual', '--style', 'declared').message).toBe(
      '--style declared cannot be combined with --di manual.',
    );

    expect(initFailure('--http', 'nest', '--style', 'declared').fix).toContain(
      'use --di tsyringe, or keep --style explicit',
    );

    expect(initFailure('--style', 'explicit', '--assembly', 'discovery').message).toBe(
      '--assembly discovery cannot be combined with --style explicit.',
    );

    expect(initFailure('--style', 'implicit').fix).toBe('Use one of: declared, explicit.');
  });

  it('assembles a declared context by discovery when asked, and tells knip and dependency-cruiser about the files nothing imports', () => {
    const root = initProject('--assembly', 'discovery', '--context', 'billing:core');

    const suffixes =
      'command,query,handler,integration-handler,event-handler,publisher,policy,job,background-job,projection,repository,gateway,adapter';

    expect(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'stack')).toMatchObject({
      style: 'declared',
      assembly: 'discovery',
    });

    expect(exists(root, 'src/contexts/billing/billing.declarations.ts')).toBe(false);

    expect(read(root, 'src/platform/composition/compose-application.ts')).toContain(
      "await discoverContext('billing', new URL('../../contexts/billing/', import.meta.url)),",
    );

    expect(read(root, 'knip.json')).toContain(
      `"src/contexts/*/{published-language/index,*.dependencies,{application,infrastructure}/**/*.{${suffixes}},presentation/**/*.{controller,guard,mapper,serializer}}.ts"`,
    );

    expect(read(root, '.dependency-cruiser.cjs')).toContain(`(${suffixes.replaceAll(',', '|')})`);
  });
});

/** What `init` records for a Fastify, class-validator, manual and Jest project, every other choice its default. */
const FASTIFY_STACK = {
  http: 'fastify',
  validation: 'class-validator',
  di: 'manual',
  events: 'outbox',
  orm: 'drizzle',
  database: 'postgres',
  tests: 'jest',
  docsUi: 'swagger',
  ci: 'github',
  authn: 'jwt',
  authz: 'rbac',
  broker: 'none',
  cache: 'none',
  httpCache: 'none',
  audit: 'on',
  eventSourcing: 'off',
  privacy: 'on',
  errors: 'none',
  logger: 'stdout',
  refusals: 'named',
  routes: 'controllers',
  representations: 'negotiated',
  forms: 'on',
  schemas: 'shared',
  storage: 'local',
  valueObjects: 'throwing',
  literals: 'named',
  values: 'classes',
  queue: 'database',
  style: 'explicit',
  packageManager: 'pnpm',
};

describe('init, the choices it records and the ones it refuses', () => {
  it('refuses to leave the outbox out with a database unless the decision is recorded', () => {
    const refused = cli(tempDir('init'), 'init', '--events', 'in-memory');
    const root = tempDir('init');
    const allowed = cli(root, 'init', '--events', 'in-memory', '--allow-no-outbox', 'One process, nothing to lose');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('--allow-no-outbox');
    expect(allowed.code).toBe(0);

    expect(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'deviations')).toEqual([
      { what: 'stack.events', adr: '0001', reason: 'One process, nothing to lose' },
    ]);

    expect(read(root, 'docs/adr/0001-publish-integration-events-without-the-transactional-outbox.md')).toContain(
      'Deviates from: `stack.events`',
    );

    expect(cli(root, 'check', '--rule', 'governance/recorded-deviation', '--rule', 'events/outbox-required').code).toBe(
      0,
    );
  });

  it('writes the config with the chosen stack and the contexts', () => {
    const root = initProject(
      '--http',
      'fastify',
      '--validation',
      'class-validator',
      '--di',
      'manual',
      '--tests',
      'jest',
      '--context',
      'billing:core',
      '--context',
      'catalog:generic',
    );

    const config = readJson(root, 'ddd-ts-kit.config.json');

    expect(jsonAt(config, 'stack')).toEqual(FASTIFY_STACK);
    // The version of the CLI that wrote the files of the platform, first, so that a later version can tell its templates from the project's changes.
    expect(Object.keys(Object(config))[0]).toBe('initVersion');
    expect(jsonAt(config, 'initVersion')).toBe(VERSION);

    expect(jsonAt(config, 'contexts')).toMatchObject({
      billing: { classification: 'core' },
      catalog: { classification: 'generic' },
    });

    expect(config).not.toHaveProperty('worker');
  });

  it('refuses inconsistent or unknown options with a fix, and writes nothing', () => {
    expect(initFailure('--http', 'nest', '--di', 'tsyringe').fix).toContain('--http nest together with --di nest');
    expect(initFailure('--http', 'koa').fix).toContain('express, fastify, hono, nest, none');
    expect(initFailure('--context', 'billing').fix).toContain('billing:core');
    expect(initFailure('--context', 'billing:central').fix).toContain('core, supporting, generic');

    expect(initFailure('--orm', 'drizzle', '--database', 'mysql').fix).toContain(
      'With drizzle, use --database postgres',
    );

    expect(initFailure('--broker', 'rabbitmq', '--orm', 'none')).toMatchObject({
      code: 2,
      message: '--broker rabbitmq cannot be combined with --orm none.',
    });
  });

  it('starts with the language: the first next step is the glossary of the first context', () => {
    const root = tempDir('init');
    const report = cli(root, 'init', '--context', 'billing:core', '--json').json();
    const readme = read(root, 'README.md');

    const steps = [
      '1. **Discover the domain**',
      '2. **Find the bounded contexts**',
      '3. **Write the glossaries**',
      '4. **Draw the context map**',
      '5. **Bootstrap**',
      '6. **Plan the slices**',
      '7. **Build slice by slice**',
      '8. **Pass the gate**',
      '9. **Document**',
    ].map((step) => readme.indexOf(step));

    expect(stringsAt(report, 'next')[0]).toMatch(/^src\/contexts\/billing\/CONTEXT\.md:\d+$/);
    expect(String(jsonAt(report, 'todos', '0', 'text'))).toContain('define the ubiquitous language first');
    expect(steps.every((position, index) => position > (steps[index - 1] ?? -1))).toBe(true);
    expect(readme).toContain('Follow them in order: it is the path the kit supports');
  });
});

describe('init in a project that already exists', () => {
  it('leaves the files it finds untouched, and merges package.json', () => {
    const root = tempDir('init');

    write(
      root,
      'package.json',
      JSON.stringify({
        name: 'legacy-shop',
        scripts: { test: 'mocha', lint: 'eslint .' },
        dependencies: { express: '^4.0.0', lodash: '^4.17.0' },
      }),
    );

    write(root, 'tsconfig.json', '{ "mine": true }\n');
    write(root, 'src/main.ts', '// mine\n');

    const report = cli(root, 'init', '--json').json();
    const merged = readJson(root, 'package.json');

    expect(stringsAt(report, 'skipped')).toEqual(['src/main.ts', 'tsconfig.json']);
    expect(stringsAt(report, 'updated')).toEqual(['package.json']);
    expect(read(root, 'tsconfig.json')).toBe('{ "mine": true }\n');
    expect(read(root, 'src/main.ts')).toBe('// mine\n');
    expect(jsonAt(merged, 'name')).toBe('legacy-shop');

    expect(textsAt(merged, 'scripts')).toMatchObject({
      test: 'mocha',
      lint: 'eslint .',
      'check:arch': 'ddd-ts-kit check',
    });

    expect(textsAt(merged, 'dependencies')).toMatchObject({
      express: '^4.0.0',
      lodash: '^4.17.0',
      '@ddd-ts-kit/kernel': KIT_RANGE,
    });

    expect(stringsAt(report, 'notes').join('\n')).toContain('keeps its own "test" script');

    // A lint that passes its warnings stays the project's: the kit's, which fails on one, is written by `init --force` alone.
    expect(stringsAt(report, 'notes').join('\n')).toContain(
      'keeps its own "lint" script; the kit expects: ddd-ts-kit lint',
    );

    expect(read(root, 'src/platform/observability/tracing.ts')).toContain("'legacy-shop'");
  });

  it('replaces existing files only with --force', () => {
    const root = tempDir('init');

    write(root, 'src/main.ts', '// mine\n');

    cli(root, 'init', '--force');

    expect(read(root, 'src/main.ts')).toContain('composeApplication');
  });

  it('keeps the recorded stack when run again, and the version that wrote the files', () => {
    const root = initProject('--http', 'fastify', '--di', 'manual');

    write(root, 'ddd-ts-kit.config.json', read(root, 'ddd-ts-kit.config.json').replace(VERSION, '0.1.0'));

    const again = stringsAt(
      cli(root, 'init', '--http', 'express', '--context', 'billing:core', '--json').json(),
      'created',
    );

    expect(again).toEqual(expect.arrayContaining(['src/contexts/billing/CONTEXT.md']));
    expect(again).not.toContain('src/main.ts');

    expect(read(root, 'src/contexts/billing/billing.module.ts')).toContain(
      'export function billingModule(platform: Platform)',
    );

    expect(readJson(root, 'ddd-ts-kit.config.json')).toMatchObject({
      initVersion: '0.1.0',
      stack: { http: 'fastify' },
      contexts: { billing: { classification: 'core' } },
    });
  });

  it('writes nothing with --dry-run', () => {
    const root = tempDir('init');

    const result = cli(root, 'init', '--context', 'billing:core', '--dry-run');

    expect(result.stdout).toContain('would create package.json');
    expect(walk(root)).toEqual([]);
  });
});
