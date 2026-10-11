import { describe, expect, it } from 'vitest';
import { cli, read, tempDir } from './helpers.js';
import { initProject } from './support/init-project.js';
import { NPM } from './support/npm.js';
import { jsonAt } from './support/json-at.js';
import { readJson } from './support/read-json.js';
import { stringsAt } from './support/strings-at.js';
import { textsAt } from './support/texts-at.js';
import { KIT_RANGE } from './support/kit-range.js';

const manifest = (root: string): unknown => readJson(root, 'package.json');

const DEFAULT_SCRIPTS = {
  start: 'node dist/src/main.js',
  dev: 'tsx watch --env-file-if-exists=.env --import ./src/platform/tracing.ts src/main.ts',
  typecheck: 'node node_modules/@typescript/native/bin/tsc -p tsconfig.json --noEmit',
  build: 'node node_modules/@typescript/native/bin/tsc -p tsconfig.build.json && ddd-ts-kit build-aliases',
  test: 'vitest run',
  'test:coverage': 'vitest run --coverage',
  'test:e2e': 'vitest run --config vitest.e2e.config.ts --passWithNoTests',
  'events:generate': 'npm run build && node dist/scripts/events.js',
  'docs:generate': 'ddd-ts-kit docs && npm run build && node dist/scripts/openapi.js && node dist/scripts/events.js',
  'docs:check':
    'ddd-ts-kit docs --check && npm run build && node dist/scripts/openapi.js --check && node dist/scripts/events.js --check',
  'db:generate': 'drizzle-kit generate',
  'db:migrate': 'drizzle-kit migrate',
  'infra:up': 'docker compose up -d --wait',
  'infra:down': 'docker compose down',
  verify:
    'npm run typecheck && npm run lint && npm run format:check && npm run test:coverage && npm run test:e2e && npm run check:arch && npm run depcruise && npm run deadcode && npm run docs:check',
  lint: 'eslint .',
  'lint:fix': 'eslint . --fix',
  'check:arch': 'ddd-ts-kit check',
  deadcode: 'knip',
  depcruise: 'ddd-ts-kit depcruise-config --check && depcruise src --config .dependency-cruiser.cjs',
  quality: 'npm run format:check && npm run lint && npm run check:arch && npm run depcruise && npm run deadcode',
};

describe('the package.json init writes', () => {
  it('declares the scripts of the default stack, and no worker until the project has one', () => {
    const root = initProject(...NPM);
    const scripts = textsAt(manifest(root), 'scripts');

    expect(jsonAt(manifest(root), 'type')).toBe('module');
    expect(scripts).toMatchObject(DEFAULT_SCRIPTS);
    expect(Object.keys(scripts)).toEqual(expect.arrayContaining(['openapi:generate', 'openapi:check', 'test']));
    expect(scripts['start:worker']).toBeUndefined();
  });

  it('declares the dependency ranges of the default stack', () => {
    const root = initProject(...NPM);
    const dependencies = textsAt(manifest(root), 'dependencies');

    expect(dependencies).toMatchObject({
      '@ddd-ts-kit/kernel': KIT_RANGE,
      '@ddd-ts-kit/validation': KIT_RANGE,
      '@ddd-ts-kit/http': KIT_RANGE,
      '@ddd-ts-kit/tracing': KIT_RANGE,
      '@ddd-ts-kit/di': KIT_RANGE,
    });

    expect(dependencies).toMatchObject({
      '@ddd-ts-kit/drizzle': KIT_RANGE,
      '@ddd-ts-kit/events': KIT_RANGE,
      '@opentelemetry/api': '^1.9.1',
      express: '^5.3.0',
      tsyringe: '^4.10.0',
      'reflect-metadata': '^0.2.2',
      zod: '^4.6.5',
    });

    expect(Object.keys(dependencies)).toEqual(expect.arrayContaining(['drizzle-orm', 'pg']));
    expect(dependencies['fastify']).toBeUndefined();
    expect(dependencies['@nestjs/core']).toBeUndefined();
    expect(dependencies['@ddd-ts-kit/scheduling']).toBeUndefined();
  });

  it('declares the tools of the default stack, and what the lint preset needs beyond the plugin', () => {
    const root = initProject(...NPM);
    const tools = textsAt(manifest(root), 'devDependencies');

    expect(tools).toMatchObject({
      'ddd-ts-kit': KIT_RANGE,
      typescript: '~6.0.3',
      '@typescript/native': 'npm:typescript@~7.0.2',
      vitest: '^5.0.3',
      '@ddd-ts-kit/testing': KIT_RANGE,
    });

    expect(tools).toMatchObject({
      '@ddd-ts-kit/eslint-plugin': KIT_RANGE,
      eslint: '^10.12.0',
      '@eslint/js': '^10.0.1',
      'typescript-eslint': '^8.71.1',
    });

    expect(tools['tsx']).toMatch(/^\^4\./);
    expect(Object.keys(tools)).toEqual(expect.arrayContaining(['drizzle-kit', '@electric-sql/pglite']));
    expect(read(root, 'eslint.config.mjs')).toContain("import { dddTsKit } from '@ddd-ts-kit/eslint-plugin';");
  });

  it.each([
    ['fastify', 'zod', 'tsyringe', { fastify: '^5.12.5' }],
    [
      'nest',
      'class-validator',
      'nest',
      {
        '@nestjs/common': '^12.1.2',
        '@nestjs/core': '^12.1.2',
        'class-validator': '^0.15.1',
        'class-transformer': '^0.5.1',
        '@ddd-ts-kit/scheduling': KIT_RANGE,
      },
    ],
  ])('adds the dependencies of %s with %s', (http, validation, di, expected) => {
    const root = initProject(...NPM, '--http', http, '--validation', validation, '--di', di);

    expect(textsAt(manifest(root), 'dependencies')).toMatchObject(expected);
  });

  it('reads the data source of TypeORM where the project keeps its platform', () => {
    const scripts = textsAt(manifest(initProject(...NPM, '--orm', 'typeorm')), 'scripts');

    expect(scripts['db:migrate']).toBe('typeorm migration:run -d dist/src/platform/database/data-source.js');

    expect(scripts['db:generate']).toBe(
      'typeorm migration:generate -d dist/src/platform/database/data-source.js migrations/change',
    );
  });
});

describe('the tsconfig.json init writes, and the import alias', () => {
  it('writes a strict NodeNext tsconfig, and decorator flags only when the stack needs them', () => {
    const plain = jsonAt(readJson(initProject(...NPM), 'tsconfig.json'), 'compilerOptions');
    const nest = jsonAt(readJson(initProject(...NPM, '--http', 'nest'), 'tsconfig.json'), 'compilerOptions');

    expect(plain).toMatchObject({
      strict: true,
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      rootDir: '.',
      outDir: 'dist',
    });

    expect(plain).not.toHaveProperty('baseUrl');
    expect(plain).not.toHaveProperty('experimentalDecorators');
    expect(nest).toMatchObject({ experimentalDecorators: true, emitDecoratorMetadata: true });
  });

  it('declares the alias under "paths" of tsconfig.json, which the build config extends, and leaves no "imports" in package.json', () => {
    const root = initProject(...NPM);

    expect(jsonAt(readJson(root, 'tsconfig.json'), 'compilerOptions', 'paths')).toEqual({
      '@/*': ['./src/*'],
      '$test/*': ['./test/*'],
      '$scripts/*': ['./scripts/*'],
    });

    expect(jsonAt(readJson(root, 'tsconfig.build.json'), 'extends')).toBe('./tsconfig.json');
    expect(jsonAt(readJson(root, 'tsconfig.build.json'), 'compilerOptions')).toBeUndefined();
    expect(jsonAt(manifest(root), 'imports')).toBeUndefined();

    expect(
      jsonAt(
        readJson(initProject(...NPM, '--orm', 'prisma'), 'tsconfig.json'),
        'compilerOptions',
        'paths',
        '$generated/*',
      ),
    ).toEqual(['./generated/*']);
  });
});

describe('the local infrastructure init writes', () => {
  it('scaffolds persistence, events, documentation and the end-to-end support of the default stack', () => {
    const created = stringsAt(cli(tempDir('init'), 'init', '--json').json(), 'created');

    const root = [
      'docker-compose.yml',
      '.env.example',
      'Dockerfile',
      '.dockerignore',
      'README.md',
      'drizzle.config.ts',
      'scripts/events.ts',
      'vitest.e2e.config.ts',
      'docs/context-map.md',
      'docs/integration/README.md',
    ];

    const platform = [
      'database/database.ts',
      'database/persistence.ts',
      'database/schema.ts',
      'database/open-test-database.ts',
      'events/start-outbox-relay.ts',
      'http/with-documentation.ts',
    ];

    expect(created).toEqual(
      expect.arrayContaining([
        ...root,
        ...platform.map((file) => `src/platform/${file}`),
        'test/e2e/support/start-application.ts',
      ]),
    );

    expect(jsonAt(readJson(initProject(...NPM), 'ddd-ts-kit.config.json'), 'stack')).toMatchObject({
      orm: 'drizzle',
      database: 'postgres',
      events: 'outbox',
    });
  });

  it('pins the local infrastructure and keeps its ports configurable', () => {
    const root = initProject(...NPM);
    const compose = read(root, 'docker-compose.yml');
    const dockerfile = read(root, 'Dockerfile');

    expect(compose).toContain('image: postgres:18');
    expect(compose).toContain('- "${POSTGRES_PORT:-5432}:5432"');
    expect(compose).toContain('healthcheck:');
    expect(compose).toContain('postgres-data:/var/lib/postgresql');
    expect(compose).toMatch(/jaeger:\n\s+image: jaegertracing\/jaeger:\d+\.\d+\.\d+\n\s+profiles: \[observability\]/);
    expect(read(root, '.env.example')).toContain('DATABASE_URL=postgres://app:app@localhost:5432/app');
    expect(dockerfile).toContain('RUN npm ci --omit=dev');
    expect(dockerfile).toContain('USER node');
    expect(dockerfile.match(/^FROM /gm)).toHaveLength(3);
  });
});
