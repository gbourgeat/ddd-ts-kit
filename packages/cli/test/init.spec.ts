import { describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir, walk, write } from './helpers.js';

interface Manifest {
  name: string;
  type: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

const manifest = (root: string): Manifest => JSON.parse(read(root, 'package.json')) as Manifest;

const RULE_FILES = ['domain', 'application', 'infrastructure', 'presentation', 'tests'];
const RULE_STACKS = ['', '--http nest', '--http none --orm none', '--di manual --orm knex --ci gitlab', '--validation class-validator --tests jest --ci both', '--orm prisma --ci none'];

describe('init', () => {
  it('bootstraps an empty directory with the default stack', () => {
    const root = tempDir('init');

    const result = cli(root, 'init', '--context', 'billing:core', '--json');
    const report = result.json() as { created: string[]; skipped: string[] };

    expect(result.code).toBe(0);
    expect(report.skipped).toEqual([]);
    expect(report.created).toEqual(
      expect.arrayContaining([
        'ddd-ts-kit.config.json',
        'package.json',
        'tsconfig.json',
        'src/main.ts',
        'src/platform/config.ts',
        'src/platform/tracing.ts',
        'src/platform/http-server.ts',
        'src/platform/platform.module.ts',
        'src/platform/application.ts',
        'scripts/openapi.ts',
        'src/shared-kernel/.gitkeep',
        '.github/workflows/ci.yml',
        'CLAUDE.md',
        '.claude/rules/domain.md',
        '.claude/rules/application.md',
        '.claude/rules/infrastructure.md',
        '.claude/rules/presentation.md',
        '.claude/rules/tests.md',
        'src/contexts/billing/CONTEXT.md',
        'src/contexts/billing/billing.module.ts',
        'src/contexts/billing/published-language/index.ts',
      ]),
    );
    expect(walk(root)).toEqual([...report.created].sort());
  });

  it('refuses to leave the outbox out with a database unless the decision is recorded', () => {
    const refused = cli(tempDir('init'), 'init', '--events', 'in-memory');
    const root = tempDir('init');
    const allowed = cli(root, 'init', '--events', 'in-memory', '--allow-no-outbox', 'One process, nothing to lose');
    const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as { deviations: unknown[] };

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('--allow-no-outbox');
    expect(allowed.code).toBe(0);
    expect(config.deviations).toEqual([{ what: 'stack.events', adr: '0001', reason: 'One process, nothing to lose' }]);
    expect(read(root, 'docs/adr/0001-publish-integration-events-without-the-transactional-outbox.md')).toContain('Deviates from: `stack.events`');
    expect(cli(root, 'check', '--rule', 'governance/recorded-deviation', '--rule', 'events/outbox-required').code).toBe(0);
  });

  it.each([
    ['rbac', 'roles.ts'],
    ['abac', 'attribute-policies.ts'],
    ['rebac', 'relationships.ts'],
    ['custom', 'custom-authorizer.contract.spec.ts'],
  ])('writes the authorizer of the model %s behind the one port', (authz, file) => {
    const root = tempDir('init');
    cli(root, 'init', '--authz', authz);

    expect(exists(root, `src/platform/auth/${file}`)).toBe(true);
    expect(read(root, 'src/platform/application.ts')).toContain("authorization: 'required'");
    expect(read(root, 'src/platform/http-server.ts')).toContain('...boundary }');
  });

  it('wires the broker that was chosen, and a development authenticator that refuses production', () => {
    const root = tempDir('init');
    cli(root, 'init', '--broker', 'rabbitmq', '--authn', 'none');

    expect(read(root, 'src/platform/events.ts')).toContain('bus.forConsumer(context)');
    expect(read(root, 'docker-compose.yml')).toContain('image: rabbitmq:4-management-alpine');
    expect(read(root, 'src/platform/config.ts')).toContain("readUrl(env, 'AMQP_URL', problems)");
    expect(read(root, 'src/platform/auth/authenticator.ts')).toContain('must never run in production');
    expect(JSON.parse(read(root, 'package.json'))).toMatchObject({ dependencies: { '@ddd-ts-kit/rabbitmq': '^0.1.0', amqplib: '^2.2.0' } });
    expect(cli(tempDir('init'), 'init', '--broker', 'rabbitmq', '--orm', 'none').code).toBe(2);
  });

  it('writes the config with the chosen stack and the contexts', () => {
    const root = tempDir('init');
    cli(root, 'init', '--http', 'fastify', '--validation', 'class-validator', '--di', 'manual', '--tests', 'jest', '--context', 'billing:core', '--context', 'catalog:generic');

    const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as { stack: Record<string, string>; contexts: Record<string, { classification: string }> };

    expect(config.stack).toEqual({ http: 'fastify', validation: 'class-validator', di: 'manual', events: 'outbox', orm: 'drizzle', database: 'postgres', tests: 'jest', docsUi: 'swagger', ci: 'github', authn: 'jwt', authz: 'rbac', broker: 'none' });
    expect(Object.keys(config.contexts)).toEqual(['billing', 'catalog']);
    expect(config.contexts['catalog']?.classification).toBe('generic');
  });

  it('declares the scripts and the dependency ranges of the stack', () => {
    const root = tempDir('init');
    cli(root, 'init');

    const { scripts, dependencies, devDependencies, type } = manifest(root);

    expect(type).toBe('module');
    expect(Object.keys(scripts)).toEqual(expect.arrayContaining(['check:arch', 'openapi:generate', 'openapi:check', 'test', 'typecheck', 'build', 'verify']));
    expect(scripts['check:arch']).toBe('ddd-ts-kit check');
    expect(dependencies).toMatchObject({
      '@ddd-ts-kit/kernel': '^0.1.0',
      '@ddd-ts-kit/validation': '^0.1.0',
      '@ddd-ts-kit/http': '^0.1.0',
      '@ddd-ts-kit/tracing': '^0.1.0',
      '@ddd-ts-kit/di': '^0.1.0',
      '@opentelemetry/api': '^1.9.1',
      express: '^5.3.0',
      tsyringe: '^4.10.0',
      'reflect-metadata': '^0.2.2',
      zod: '^4.6.5',
    });
    expect(devDependencies).toMatchObject({ 'ddd-ts-kit': '^0.1.0', typescript: '~6.0.3', '@typescript/native': 'npm:typescript@~7.0.2', vitest: '^5.0.3' });
    expect(scripts['typecheck']).toBe('node node_modules/@typescript/native/bin/tsc -p tsconfig.json --noEmit');
    expect(scripts['build']).toBe('node node_modules/@typescript/native/bin/tsc -p tsconfig.build.json');
    expect(dependencies['fastify']).toBeUndefined();
    expect(dependencies['@nestjs/core']).toBeUndefined();
  });

  it.each([
    ['fastify', 'zod', 'tsyringe', { fastify: '^5.12.5' }],
    ['nest', 'class-validator', 'nest', { '@nestjs/common': '^12.1.2', '@nestjs/core': '^12.1.2', 'class-validator': '^0.15.1', 'class-transformer': '^0.5.1' }],
  ])('adds the dependencies of %s with %s', (http, validation, di, expected) => {
    const root = tempDir('init');
    cli(root, 'init', '--http', http, '--validation', validation, '--di', di);

    expect(manifest(root).dependencies).toMatchObject(expected);
  });

  it('writes a strict NodeNext tsconfig with the alias, and decorator flags only when the stack needs them', () => {
    const plain = tempDir('init');
    const nest = tempDir('init');
    cli(plain, 'init');
    cli(nest, 'init', '--http', 'nest');

    const options = (root: string): Record<string, unknown> => (JSON.parse(read(root, 'tsconfig.json')) as { compilerOptions: Record<string, unknown> }).compilerOptions;

    expect(options(plain)).toMatchObject({ strict: true, module: 'NodeNext', moduleResolution: 'NodeNext', paths: { '@/*': ['./src/*'] } });
    expect(options(plain)['experimentalDecorators']).toBeUndefined();
    expect(options(nest)).toMatchObject({ experimentalDecorators: true, emitDecoratorMetadata: true });
  });

  it('initialises tracing before anything else in main.ts', () => {
    const root = tempDir('init');
    cli(root, 'init');

    const firstStatement = read(root, 'src/main.ts').split('\n').find((line) => line.trim() !== '' && !line.startsWith('//'));

    expect(firstStatement).toBe("import { tracing } from './platform/tracing.js';");
    expect(read(root, 'src/platform/tracing.ts').split('\n')[0]).toBe("import { initTracing } from '@ddd-ts-kit/tracing/node';");
  });

  it('writes a short project guide: commands, the map of the rule files, generated files, the TypeScript note and the plugin skills', () => {
    const root = tempDir('init');
    cli(root, 'init');
    const guide = read(root, 'CLAUDE.md');

    expect(guide.split('\n').length).toBeLessThan(40);
    for (const expected of ['npm run verify', 'npx ddd-ts-kit check', 'npx ddd-ts-kit list --json', 'npx ddd-ts-kit docs', 'openapi/openapi.json', 'never `npx tsc`', '/ddd-ts-kit:model-context', '/ddd-ts-kit:use-case', '/ddd-ts-kit:quality-gate']) {
      expect(guide, expected).toContain(expected);
    }
    for (const rule of RULE_FILES) expect(guide).toContain(`.claude/rules/${rule}.md`);
    // What is path-scoped in a rules file is not repeated for every session.
    for (const id of ['layer/domain-purity', 'tree/closed', 'naming/suffix', 'composition/only-in-module']) expect(guide, id).not.toContain(id);
  });

  it.each(RULE_STACKS)('renders rule files whose frontmatter holds only `paths` (%s)', (...flags) => {
    const root = tempDir('init');
    cli(root, 'init', ...flags.join(' ').split(' ').filter((flag) => flag !== ''));

    for (const rule of RULE_FILES) {
      const text = read(root, `.claude/rules/${rule}.md`);
      const frontmatter = parseFrontmatter(text);
      expect(Object.keys(frontmatter), rule).toEqual(['paths']);
      expect(frontmatter['paths']?.length, rule).toBeGreaterThan(0);
      for (const glob of frontmatter['paths'] ?? []) expect(glob, rule).toMatch(/^[\w.*/-]+$/);
      expect(text.trimEnd().split('\n').length, rule).toBeLessThan(25);
      expect(text.trimEnd().split('\n').at(-1), rule).toMatch(/\/ddd-ts-kit:|npx ddd-ts-kit generate/);
    }
    expect(read(root, '.claude/rules/domain.md')).toContain('  - "src/contexts/*/domain/**"');
  });

  it('leaves an existing project untouched where it already has files, and merges package.json', () => {
    const root = tempDir('init');
    write(root, 'package.json', JSON.stringify({ name: 'legacy-shop', scripts: { test: 'mocha', lint: 'eslint .' }, dependencies: { express: '^4.0.0', lodash: '^4.17.0' } }));
    write(root, 'tsconfig.json', '{ "mine": true }\n');
    write(root, 'src/main.ts', '// mine\n');

    const result = cli(root, 'init', '--json');
    const report = result.json() as { created: string[]; updated: string[]; skipped: string[]; notes: string[] };

    expect(report.skipped).toEqual(['src/main.ts', 'tsconfig.json']);
    expect(report.updated).toEqual(['package.json']);
    expect(read(root, 'tsconfig.json')).toBe('{ "mine": true }\n');
    expect(read(root, 'src/main.ts')).toBe('// mine\n');
    const merged = manifest(root);
    expect(merged.name).toBe('legacy-shop');
    expect(merged.scripts).toMatchObject({ test: 'mocha', lint: 'eslint .', 'check:arch': 'ddd-ts-kit check', typecheck: 'node node_modules/@typescript/native/bin/tsc -p tsconfig.json --noEmit' });
    expect(merged.dependencies).toMatchObject({ express: '^4.0.0', lodash: '^4.17.0', '@ddd-ts-kit/kernel': '^0.1.0' });
    expect(report.notes.join('\n')).toContain('keeps its own "test" script');
    expect(read(root, 'src/platform/tracing.ts')).toContain("'legacy-shop'");
  });

  it('replaces existing files only with --force', () => {
    const root = tempDir('init');
    write(root, 'src/main.ts', '// mine\n');

    cli(root, 'init', '--force');

    expect(read(root, 'src/main.ts')).toContain('composeApplication');
  });

  it('keeps the recorded stack when run again', () => {
    const root = tempDir('init');
    cli(root, 'init', '--http', 'fastify', '--di', 'manual');

    const again = cli(root, 'init', '--http', 'express', '--context', 'billing:core', '--json').json() as { created: string[] };

    expect(again.created).toEqual(expect.arrayContaining(['src/contexts/billing/CONTEXT.md']));
    expect(again.created).not.toContain('src/main.ts');
    expect(read(root, 'src/contexts/billing/billing.module.ts')).toContain('export function wireBilling(platform: Platform)');
    expect(JSON.parse(read(root, 'ddd-ts-kit.config.json'))).toMatchObject({ stack: { http: 'fastify' }, contexts: { billing: { classification: 'core' } } });
  });

  it('writes nothing with --dry-run', () => {
    const root = tempDir('init');

    const result = cli(root, 'init', '--context', 'billing:core', '--dry-run');

    expect(result.stdout).toContain('would create package.json');
    expect(walk(root)).toEqual([]);
  });

  it('refuses inconsistent or unknown options with a fix', () => {
    const root = tempDir('init');
    const failure = (...args: string[]): { message: string; fix: string } => (cli(root, 'init', ...args, '--json').json() as { error: { message: string; fix: string } }).error;

    expect(failure('--http', 'nest', '--di', 'tsyringe').fix).toContain('--http nest together with --di nest');
    expect(failure('--http', 'koa').fix).toContain('express, fastify, nest, none');
    expect(failure('--context', 'billing').fix).toContain('billing:core');
    expect(failure('--context', 'billing:central').fix).toContain('core, supporting, generic');
    expect(exists(root, 'package.json')).toBe(false);
  });

  it('skips the HTTP pieces when there is no HTTP stack', () => {
    const root = tempDir('init');
    cli(root, 'init', '--http', 'none', '--di', 'manual');

    expect(exists(root, 'scripts/openapi.ts')).toBe(false);
    expect(exists(root, 'src/platform/http-server.ts')).toBe(false);
    expect(manifest(root).scripts['openapi:check']).toBeUndefined();
    expect(read(root, '.github/workflows/ci.yml')).not.toContain('openapi');
  });

  it('scaffolds persistence, events and local infrastructure for the default stack', () => {
    const root = tempDir('init');
    const report = cli(root, 'init', '--json').json() as { created: string[] };

    expect(report.created).toEqual(
      expect.arrayContaining([
        'docker-compose.yml',
        '.env.example',
        'Dockerfile',
        '.dockerignore',
        'README.md',
        'drizzle.config.ts',
        'src/platform/database/database.ts',
        'src/platform/database/persistence.ts',
        'src/platform/database/schema.ts',
        'src/platform/database/testing.ts',
        'src/platform/outbox-relay.ts',
        'src/platform/http-docs.ts',
        'scripts/events.ts',
        'vitest.e2e.config.ts',
        'test/e2e/support/application.ts',
        'docs/context-map.md',
        'docs/integration/README.md',
      ]),
    );
    expect(JSON.parse(read(root, 'ddd-ts-kit.config.json'))).toMatchObject({ stack: { orm: 'drizzle', database: 'postgres', events: 'outbox' } });
    const { scripts, dependencies, devDependencies } = manifest(root);
    expect(scripts).toMatchObject({
      dev: 'tsx watch --env-file-if-exists=.env --import ./src/platform/tracing.ts src/main.ts',
      'test:e2e': 'vitest run --config vitest.e2e.config.ts --passWithNoTests',
      'events:generate': 'npm run build && node dist/scripts/events.js',
      'docs:generate': 'ddd-ts-kit docs && npm run build && node dist/scripts/openapi.js && node dist/scripts/events.js',
      'docs:check': 'ddd-ts-kit docs --check && npm run build && node dist/scripts/openapi.js --check && node dist/scripts/events.js --check',
      'db:generate': 'drizzle-kit generate',
      'db:migrate': 'drizzle-kit migrate',
      'infra:up': 'docker compose up -d --wait',
      'infra:down': 'docker compose down',
      verify: 'npm run typecheck && npm run lint && npm run test && npm run test:e2e && npm run check:arch && npm run depcruise && npm run deadcode && npm run docs:check',
      lint: 'eslint .',
      'lint:fix': 'eslint . --fix',
      deadcode: 'knip',
      depcruise: 'ddd-ts-kit depcruise-config --check && depcruise src --config .dependency-cruiser.cjs',
      quality: 'npm run lint && npm run check:arch && npm run depcruise && npm run deadcode',
    });
    expect(dependencies).toMatchObject({ '@ddd-ts-kit/drizzle': '^0.1.0', '@ddd-ts-kit/events': '^0.1.0', 'drizzle-orm': expect.any(String), pg: expect.any(String) });
    expect(devDependencies).toMatchObject({ tsx: expect.stringMatching(/^\^4\./), '@ddd-ts-kit/testing': '^0.1.0', 'drizzle-kit': expect.any(String), '@electric-sql/pglite': expect.any(String) });
  });

  it('pins the local infrastructure and keeps its ports configurable', () => {
    const root = tempDir('init');
    cli(root, 'init');
    const compose = read(root, 'docker-compose.yml');

    expect(compose).toContain('image: postgres:18');
    expect(compose).toContain('- "${POSTGRES_PORT:-5432}:5432"');
    expect(compose).toContain('healthcheck:');
    expect(compose).toContain('postgres-data:/var/lib/postgresql');
    expect(compose).toMatch(/jaeger:\n\s+image: jaegertracing\/jaeger:\d+\.\d+\.\d+\n\s+profiles: \[observability\]/);
    expect(read(root, '.env.example')).toContain('DATABASE_URL=postgres://app:app@localhost:5432/app');
    const dockerfile = read(root, 'Dockerfile');
    expect(dockerfile).toContain('RUN npm ci --omit=dev');
    expect(dockerfile).toContain('USER node');
    expect(dockerfile.match(/^FROM /gm)).toHaveLength(3);
  });

  it('validates the database URL at boot, starts the outbox relay and mounts the documentation', () => {
    const root = tempDir('init');
    cli(root, 'init', '--docs-ui', 'scalar');

    expect(read(root, 'src/platform/config.ts')).toContain("databaseUrl: readUrl(env, 'DATABASE_URL', problems),");
    expect(read(root, 'src/main.ts')).toContain('const relay = startOutboxRelay({ store: persistence.outbox, publisher: application.eventBus, intervalMs: config.outboxRelayIntervalMs });');
    expect(read(root, 'src/platform/http-docs.ts')).toContain("openApiDocsRoutes(document, { ui: 'scalar' })");
    expect(read(root, 'src/platform/http-server.ts')).toContain('withDocumentation(routes, config)');
    expect(read(root, 'src/platform/platform.module.ts')).toContain('eventPublisher: new OutboxPublisher(persistence.outbox),');
  });

  it('leaves out what the stack does not have', () => {
    const root = tempDir('init');
    cli(root, 'init', '--orm', 'none', '--docs-ui', 'none');

    expect(JSON.parse(read(root, 'ddd-ts-kit.config.json'))).toMatchObject({ stack: { orm: 'none', database: 'none', events: 'in-memory' } });
    expect(exists(root, 'src/platform/http-docs.ts')).toBe(false);
    expect(exists(root, 'src/platform/outbox-relay.ts')).toBe(false);
    expect(exists(root, 'src/platform/database/schema.ts')).toBe(false);
    expect(read(root, 'docker-compose.yml')).not.toContain('postgres');
    expect(read(root, 'src/platform/config.ts')).not.toContain('DATABASE_URL');
    expect(manifest(root).scripts['db:migrate']).toBe('echo "No database to migrate."');
    expect(manifest(root).scripts['db:generate']).toBeUndefined();
  });

  it.each([
    ['knex', ['knexfile.js', 'migrations/0001_initial.js'], '@ddd-ts-kit/knex'],
    ['prisma', ['prisma/schema.prisma', 'prisma.config.ts'], '@ddd-ts-kit/prisma'],
    ['typeorm', ['src/platform/database/data-source.ts'], '@ddd-ts-kit/typeorm'],
    ['custom', ['src/platform/database/persistence.contract.spec.ts'], '@ddd-ts-kit/events'],
  ])('scaffolds the persistence of --orm %s', (orm, files, dependency) => {
    const root = tempDir('init');
    cli(root, 'init', '--orm', orm);

    for (const file of files) expect(exists(root, file), file).toBe(true);
    expect(exists(root, 'src/platform/database/persistence.ts')).toBe(true);
    expect(manifest(root).dependencies[dependency]).toBe('^0.1.0');
  });

  it('refuses a combination of ORM and database that has no adapter', () => {
    const root = tempDir('init');
    const failure = (cli(root, 'init', '--orm', 'drizzle', '--database', 'mysql', '--json').json() as { error: { fix: string } }).error;

    expect(failure.fix).toContain('With drizzle, use --database postgres');
  });

  it('starts with the language: the first next step is the glossary of the first context', () => {
    const root = tempDir('init');
    const report = cli(root, 'init', '--context', 'billing:core', '--json').json() as { next: string[]; todos: { text: string }[] };

    expect(report.next[0]).toMatch(/^src\/contexts\/billing\/CONTEXT\.md:\d+$/);
    expect(report.todos[0]?.text).toContain('define the ubiquitous language first');
    const readme = read(root, 'README.md');
    const steps = ['1. Define the vocabulary', '2. Model', '3. Scaffold', '4. Test', '5. Verify'].map((step) => readme.indexOf(step));
    expect(steps.every((position, index) => position > (steps[index - 1] ?? -1))).toBe(true);
  });
});

/** A minimal reading of YAML frontmatter: top-level keys, each holding a list of quoted strings. */
function parseFrontmatter(text: string): Record<string, string[]> {
  const [, block] = /^---\n([\s\S]*?)\n---\n/.exec(text) ?? [];
  if (block === undefined) throw new Error('The file does not start with a frontmatter block.');
  const keys: Record<string, string[]> = {};
  let current: string[] | undefined;
  for (const line of block.split('\n')) {
    const key = /^([A-Za-z][\w-]*):\s*$/.exec(line)?.[1];
    const item = /^ {2}- "((?:[^"\\]|\\.)*)"$/.exec(line)?.[1];
    if (key !== undefined) {
      current = [];
      keys[key] = current;
    } else if (item !== undefined && current !== undefined) {
      current.push(item);
    } else {
      throw new Error(`Unreadable frontmatter line: ${line}`);
    }
  }
  return keys;
}
