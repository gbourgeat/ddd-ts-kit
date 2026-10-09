import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { writeBusinessDecisions } from './first-class-proof.js';
import { cli, DEFAULT_STACK, read, REPO_ROOT, scaffoldEverything, tempDir, walk, write, type StackFlags } from './helpers.js';

interface CheckJson {
  ok: boolean;
  errors: number;
  warnings: number;
  files: number;
  violations: unknown[];
}

const REBAC_ON_RABBITMQ: StackFlags = { ...DEFAULT_STACK, authz: 'rebac', broker: 'rabbitmq', ci: 'gitlab' };
const ABAC_ON_KNEX_BY_HAND: StackFlags = { ...DEFAULT_STACK, orm: 'knex', di: 'manual', authz: 'abac' };

/** The stack of the example application: Keycloak, relationships, knex, Redis protocol cache, audit trail, with RabbitMQ or without a broker. */
const FIRST_CLASS: StackFlags = { http: 'express', validation: 'class-validator', di: 'tsyringe', tests: 'vitest', orm: 'knex', events: 'outbox', authn: 'keycloak', authz: 'rebac', broker: 'rabbitmq', cache: 'redis', audit: 'on' };
const FIRST_CLASS_WITHOUT_BROKER: StackFlags = { ...FIRST_CLASS, broker: 'none' };

const STACKS: readonly StackFlags[] = [
  { http: 'express', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'drizzle', events: 'outbox' },
  { http: 'fastify', validation: 'class-validator', di: 'manual', tests: 'vitest', orm: 'drizzle', events: 'outbox' },
  { http: 'nest', validation: 'standard-schema', di: 'nest', tests: 'vitest', orm: 'drizzle', events: 'in-memory' },
  { http: 'nest', validation: 'class-validator', di: 'nest', tests: 'vitest', orm: 'none', events: 'in-memory' },
  { http: 'express', validation: 'none', di: 'manual', tests: 'jest', orm: 'custom', events: 'outbox' },
  { http: 'fastify', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'none', events: 'outbox' },
  { http: 'express', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'custom', events: 'in-memory' },
  { http: 'express', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'knex', events: 'outbox' },
  { http: 'fastify', validation: 'zod', di: 'manual', tests: 'vitest', orm: 'prisma', events: 'outbox' },
  { http: 'express', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'typeorm', events: 'outbox' },
  { http: 'none', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'drizzle', events: 'outbox' },
  { http: 'none', validation: 'none', di: 'manual', tests: 'vitest', orm: 'none', events: 'in-memory' },
  REBAC_ON_RABBITMQ,
  ABAC_ON_KNEX_BY_HAND,
  { http: 'fastify', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'drizzle', events: 'outbox', authn: 'none', authz: 'custom', broker: 'custom' },
  { http: 'express', validation: 'zod', di: 'manual', tests: 'vitest', orm: 'custom', events: 'outbox', authn: 'none', authz: 'rebac', broker: 'rabbitmq' },
  FIRST_CLASS,
  FIRST_CLASS_WITHOUT_BROKER,
  { http: 'fastify', validation: 'zod', di: 'manual', tests: 'vitest', orm: 'drizzle', events: 'outbox', authn: 'keycloak', cache: 'redis' },
  { http: 'nest', validation: 'standard-schema', di: 'nest', tests: 'vitest', orm: 'knex', events: 'outbox', cache: 'redis', broker: 'rabbitmq' },
  { http: 'express', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'drizzle', events: 'outbox', audit: 'off' },
  { http: 'none', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'knex', events: 'outbox', cache: 'redis' },
  { http: 'fastify', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'none', events: 'in-memory', audit: 'on', cache: 'redis' },
];

const label = (stack: StackFlags): string => Object.entries(stack).map(([key, value]) => `${key} ${value}`).join(', ');

/**
 * The homogeneity guarantee: whatever the generator writes, the checker accepts.
 * A template and a rule can therefore never drift apart without this test failing.
 */
describe('a freshly generated project', () => {
  it.each(STACKS.map((stack) => [label(stack), stack] as const))('has zero violation (%s)', (_label, stack) => {
    const root = tempDir('e2e');
    scaffoldEverything(root, stack);

    const result = cli(root, 'check', '--json');
    const json = result.json() as CheckJson;

    expect(json.violations).toEqual([]);
    expect(json).toMatchObject({ ok: true, errors: 0, warnings: 0 });
    expect(json.files).toBeGreaterThan(45);
    expect(cli(root, 'docs', '--check').code).toBe(0);
    expect(result.code).toBe(0);
  });

  it('holds every kind of the generator', () => {
    const root = tempDir('e2e');
    scaffoldEverything(root);
    const billing = walk(root, 'src/contexts/billing').map((file) => file.replace('src/contexts/billing/', ''));

    expect(billing).toEqual(
      expect.arrayContaining([
        'CONTEXT.md',
        'billing.module.ts',
        'domain/aggregates/invoice.aggregate.ts',
        'domain/entities/invoice-line.entity.ts',
        'domain/value-objects/money.vo.ts',
        'domain/events/invoice-issued.event.ts',
        'domain/errors/invoice-already-issued.error.ts',
        'domain/services/pricing.service.ts',
        'domain/repositories/invoice.repository.ts',
        'application/commands/issue-invoice/issue-invoice.command.ts',
        'application/commands/issue-invoice/issue-invoice.handler.ts',
        'application/queries/list-invoices/list-invoices.query.ts',
        'application/queries/list-invoices/list-invoices.handler.ts',
        'application/ports/payment-gateway.port.ts',
        'application/ports/list-invoices-reader.port.ts',
        'application/event-handlers/invoice-issued.event-handler.ts',
        'application/integration/publishers/invoice-issued.publisher.ts',
        'infrastructure/persistence/drizzle-invoice.repository.ts',
        'infrastructure/persistence/invoice.mapper.ts',
        'infrastructure/persistence/billing.schema.ts',
        'infrastructure/persistence/in-memory-list-invoices.reader.ts',
        'infrastructure/anti-corruption/legacy-erp.translator.ts',
        'presentation/http/issue-invoice.route.ts',
        'presentation/http/list-invoices.route.ts',
        'published-language/index.ts',
        'published-language/invoice-issued.v1.integration-event.ts',
        'test/builders/invoice.builder.ts',
        'test/fakes/invoice.repository.fake.ts',
        'test/fakes/payment-gateway.fake.ts',
        'test/integration/invoice.repository.contract.spec.ts',
        'test/unit/invoice.aggregate.spec.ts',
        'test/unit/issue-invoice.handler.spec.ts',
        'test/unit/issue-invoice.route.spec.ts',
      ]),
    );
    expect(walk(root, 'src/contexts/shipping')).toEqual(
      expect.arrayContaining(['src/contexts/shipping/application/integration/consumers/billing-invoice-issued.consumer.ts', 'src/contexts/shipping/test/unit/billing-invoice-issued.consumer.spec.ts']),
    );
  });
});

/** The compiler the generated scripts call by path: `npx tsc` would run the older one, kept for the tools. */
const NATIVE_COMPILER = path.join(REPO_ROOT, 'node_modules/@typescript/native/bin/tsc');

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): type-checks the generated projects against the sources
 * of the workspace packages, so that a template can never lag behind their real API.
 */
describe.runIf(process.env['DDD_TS_KIT_E2E'] === '1')('a freshly generated project type-checks against the workspace packages', () => {
  const workspace = (name: string, entry = 'index'): string => path.join(REPO_ROOT, 'packages', name, 'src', `${entry}.ts`);

  // Left out: jest (its types are not installed in this workspace), prisma (its client has to be
  // generated first) and typeorm (not installed at the workspace root).
  const CHECKABLE = STACKS.filter((stack) => stack.tests === 'vitest' && stack.orm !== 'prisma' && stack.orm !== 'typeorm');

  it.each(CHECKABLE.map((stack) => [label(stack), stack] as const))('%s', (_label, stack) => {
    const root = tempDir('typecheck');
    scaffoldEverything(root, stack);
    fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(root, 'node_modules'), 'dir');
    write(
      root,
      'tsconfig.e2e.json',
      JSON.stringify({
        extends: './tsconfig.json',
        compilerOptions: {
          noEmit: true,
          rootDir: '/',
          paths: {
            '@/*': ['./src/*'],
            '@ddd-ts-kit/kernel': [workspace('kernel')],
            '@ddd-ts-kit/kernel/*': [workspace('kernel', '*')],
            '@ddd-ts-kit/validation': [workspace('validation')],
            '@ddd-ts-kit/validation/*': [workspace('validation', '*')],
            '@ddd-ts-kit/http': [workspace('http')],
            '@ddd-ts-kit/http/*': [workspace('http', '*')],
            '@ddd-ts-kit/tracing': [workspace('tracing')],
            '@ddd-ts-kit/tracing/*': [workspace('tracing', '*')],
            '@ddd-ts-kit/di': [workspace('di')],
            '@ddd-ts-kit/di/*': [workspace('di', '*')],
            '@ddd-ts-kit/events': [workspace('events')],
            '@ddd-ts-kit/events/*': [workspace('events', '*')],
            '@ddd-ts-kit/testing': [workspace('testing')],
            '@ddd-ts-kit/testing/*': [workspace('testing', '*')],
            '@ddd-ts-kit/drizzle/*': [workspace('drizzle', '*')],
            '@ddd-ts-kit/knex': [workspace('knex')],
            '@ddd-ts-kit/auth': [workspace('auth')],
            '@ddd-ts-kit/auth/*': [workspace('auth', '*')],
            '@ddd-ts-kit/rabbitmq': [workspace('rabbitmq')],
            '@ddd-ts-kit/aspects': [workspace('aspects')],
            '@ddd-ts-kit/aspects/*': [workspace('aspects', '*')],
            '@ddd-ts-kit/audit': [workspace('audit')],
            '@ddd-ts-kit/audit/*': [workspace('audit', '*')],
            '@ddd-ts-kit/redis': [workspace('redis')],
            '@ddd-ts-kit/redis/*': [workspace('redis', '*')],
          },
        },
        include: ['src', 'scripts', 'test', path.join(REPO_ROOT, 'packages/validation/src/*.d.ts')],
      }),
    );

    let output = '';
    try {
      execFileSync(process.execPath, [NATIVE_COMPILER, '-p', 'tsconfig.e2e.json'], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
      output = error instanceof Error && 'stdout' in error ? String(error.stdout) : String(error);
    }

    expect(output).toBe('');
  }, 120_000);
});

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): runs what `npm run verify` runs in a generated project of
 * the default stack, against the built workspace packages (`npm run build` at the root first).
 */
describe.runIf(process.env['DDD_TS_KIT_E2E'] === '1')('a freshly generated project of the default stack really runs', () => {
  const bin = (name: string): string => path.join(REPO_ROOT, 'node_modules/.bin', name);

  /** Real services are named by the environment of this run; without them the generated projects stay in the process. */
  const SERVICES = {
    AMQP_URL: process.env['DDD_TS_KIT_TEST_AMQP_URL'] ?? '',
    REDIS_URL: process.env['DDD_TS_KIT_TEST_REDIS_URL'] ?? '',
  };

  function runIn(root: string, command: string, args: readonly string[], extra: Readonly<Record<string, string>> = {}): string {
    try {
      return execFileSync(command, [...args], { cwd: root, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, DATABASE_URL: '', ...SERVICES, OTEL_SDK_DISABLED: 'true', NO_COLOR: '1', FORCE_COLOR: '0', ...extra } });
    } catch (error) {
      const output = error instanceof Error && 'stdout' in error ? `${String(error.stdout)}\n${String(Reflect.get(error, 'stderr'))}` : String(error);
      throw new Error(`${command} ${args.join(' ')} failed:\n${output}`, { cause: error });
    }
  }

  const PROOF = [
    ['the default stack: jwt, rbac, no broker', DEFAULT_STACK],
    ['relationships and RabbitMQ, GitLab pipeline', REBAC_ON_RABBITMQ],
    ['attribute policies on knex, wired by hand', ABAC_ON_KNEX_BY_HAND],
  ] as const;

  it.each(PROOF)('passes its own specs, its end-to-end specs (401, 403, 2xx with tokens signed in the test), its build and its documentation checks (%s)', (_label, stack) => {
    const root = tempDir('run');
    scaffoldEverything(root, stack);
    fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(root, 'node_modules'), 'dir');

    const specs = runIn(root, bin('vitest'), ['run']);
    expect(specs).toMatch(/Test Files\s+\d+ passed/);
    expect(specs).not.toContain('failed');
    expect(fs.existsSync(path.join(root, 'src/contexts/billing/test/integration/invoice.repository.contract.spec.ts'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'test/architecture/extractable.spec.ts'))).toBe(true);
    // A decorated adapter under test: the runner does not transform standard decorators, the plugin of vitest.config.ts does.
    expect(read(root, 'src/contexts/billing/infrastructure/external/remote-tax-rates.adapter.ts')).toContain('@Retry({ attempts: 3');
    expect(runIn(root, bin('vitest'), ['run', 'src/contexts/billing/test/integration/remote-tax-rates.adapter.spec.ts'])).toMatch(/Tests\s+1 passed/);

    const endToEnd = runIn(root, bin('vitest'), ['run', '--config', 'vitest.e2e.config.ts']);
    expect(endToEnd).toMatch(/Tests\s+4 passed/);
    expect(read(root, 'test/e2e/issue-invoice.e2e.spec.ts')).toMatch(/expectStatus\(response, 401\)[\s\S]*expectStatus\(response, 403\)[\s\S]*expectStatus\(response, 201\)/);

    buildAndCheckDocuments(root);
  }, 240_000);

  function buildAndCheckDocuments(root: string): void {
    runIn(root, process.execPath, [NATIVE_COMPILER, '-p', 'tsconfig.build.json']);
    runIn(root, process.execPath, ['dist/scripts/openapi.js']);
    runIn(root, process.execPath, ['dist/scripts/events.js']);
    runIn(root, process.execPath, ['dist/scripts/openapi.js', '--check']);
    runIn(root, process.execPath, ['dist/scripts/events.js', '--check']);
    expect(walk(root, 'docs/integration')).toEqual(['docs/integration/README.md', 'docs/integration/asyncapi.json', 'docs/integration/event-catalog.md']);
    expect(fs.readFileSync(path.join(root, 'docs/integration/event-catalog.md'), 'utf8')).toContain('Consumers: `shipping`');
    expect(read(root, 'openapi/openapi.json')).toContain('"securitySchemes"');
    expect(fs.existsSync(path.join(root, 'dist/src/apps/shipping/main.js'))).toBe(true);
    expect(cli(root, 'check').code).toBe(0);
    expect(cli(root, 'docs', '--check').code).toBe(0);
  }

  /**
   * The stack of the example application, with the business decisions of ./first-class-proof.ts:
   * tokens shaped like those of a Keycloak realm and signed in the test, a list narrowed by
   * relationships, the audit trail read through its route, and the correlation id of a request
   * followed to the published event. With DDD_TS_KIT_TEST_DATABASE_URL, _AMQP_URL and _REDIS_URL
   * it runs on those servers (the database is migrated first); without them, in the process.
   */
  it.each([
    ['with RabbitMQ', FIRST_CLASS],
    ['without a broker', FIRST_CLASS_WITHOUT_BROKER],
  ] as const)('the first-class stack %s passes its specs, its end-to-end proof, its build and its documentation checks', (_label, stack) => {
    const root = tempDir('first-class');
    scaffoldEverything(root, stack);
    writeBusinessDecisions(root);
    fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(root, 'node_modules'), 'dir');
    const database = process.env['DDD_TS_KIT_TEST_DATABASE_URL'] ?? '';

    const specs = runIn(root, bin('vitest'), ['run']);
    expect(specs).toMatch(/Test Files\s+\d+ passed/);
    expect(specs).not.toContain('failed');
    expect(cli(root, 'generate', 'adapter', 'billing', 'PaymentGateway', '--decorators', '--force').stderr).toContain('experimentalDecorators');

    buildAndCheckDocuments(root);
    expect(read(root, 'openapi/openapi.json')).toContain('"/audit/entries"');
    if (database !== '') runIn(root, bin('knex'), ['migrate:latest'], { DATABASE_URL: database });

    const endToEnd = runIn(root, bin('vitest'), ['run', '--config', 'vitest.e2e.config.ts'], { DATABASE_URL: database });
    expect(endToEnd).toMatch(/Tests\s+8 passed/);
    expect(endToEnd).not.toContain('failed');
  }, 480_000);

  /**
   * A node_modules as `npm install` leaves it: the packages of the kit are real directories (a link
   * into the workspace would make the import graph leave the project), the rest links to the workspace.
   */
  function installAsPublished(root: string): void {
    const installed = path.join(root, 'node_modules');
    fs.mkdirSync(path.join(installed, '@ddd-ts-kit'), { recursive: true });
    for (const entry of fs.readdirSync(path.join(REPO_ROOT, 'node_modules'))) {
      if (entry !== '@ddd-ts-kit' && entry !== 'ddd-ts-kit') fs.symlinkSync(path.join(REPO_ROOT, 'node_modules', entry), path.join(installed, entry));
    }
    for (const directory of fs.readdirSync(path.join(REPO_ROOT, 'packages'))) {
      const source = path.join(REPO_ROOT, 'packages', directory);
      linkOwnDependencies(source, installed);
      const { name } = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8')) as { name: string };
      for (const part of ['package.json', 'dist', 'templates', 'prisma']) {
        if (fs.existsSync(path.join(source, part))) fs.cpSync(path.join(source, part), path.join(installed, name, part), { recursive: true });
      }
    }
    // The two runners the workspace does not install: knip only needs to see that they bring the binaries the scripts name.
    for (const runner of ['tsx', 'drizzle-kit']) {
      if (fs.existsSync(path.join(installed, runner))) continue;
      write(installed, `${runner}/package.json`, JSON.stringify({ name: runner, version: '0.0.0', bin: { [runner]: 'bin.js' } }));
      write(installed, `${runner}/bin.js`, '');
    }
  }

  /** What npm kept inside one workspace package instead of hoisting (the Redis client): a project that installs the kit gets it at the top. */
  function linkOwnDependencies(source: string, installed: string): void {
    const own = path.join(source, 'node_modules');
    for (const entry of fs.existsSync(own) ? fs.readdirSync(own) : []) {
      if (entry.startsWith('.') || fs.existsSync(path.join(installed, entry))) continue;
      fs.symlinkSync(path.join(own, entry), path.join(installed, entry));
    }
  }

  /** What the analyzer prints when it fails, or an empty string when it passes. */
  function findingsOf(root: string, analyzer: readonly [command: string, ...args: string[]]): string {
    const [command, ...args] = analyzer;
    try {
      runIn(root, bin(command), args);
      return '';
    } catch (error) {
      return String(error);
    }
  }

  const ESLINT = ['eslint', '.'] as const;
  const DEPCRUISE = ['depcruise', 'src', '--config', '.dependency-cruiser.cjs'] as const;
  const KNIP = ['knip'] as const;
  const SERVICE = 'src/contexts/billing/domain/services/pricing.service.ts';

  describe('under the three analyzers of the pipeline', () => {
    let root: string;
    let service: string;

    beforeAll(() => {
      root = tempDir('analyzers');
      scaffoldEverything(root);
      installAsPublished(root);
      service = read(root, SERVICE);
    }, 120_000);

    afterEach(() => {
      write(root, SERVICE, service);
    });

    it('has no finding: ESLint with the preset, dependency-cruiser with the generated configuration, knip', () => {
      expect(cli(root, 'depcruise-config', '--check').code).toBe(0);
      expect(findingsOf(root, ESLINT)).toBe('');
      expect(findingsOf(root, DEPCRUISE)).toBe('');
      expect(findingsOf(root, KNIP)).toBe('');
    }, 240_000);

    it.each([
      ['relationships and RabbitMQ, GitLab pipeline', REBAC_ON_RABBITMQ],
      ['attribute policies on knex, wired by hand', ABAC_ON_KNEX_BY_HAND],
      ['the first-class stack with RabbitMQ', FIRST_CLASS],
      ['the first-class stack without a broker', FIRST_CLASS_WITHOUT_BROKER],
    ] as const)('has no finding either with %s', (_label, stack) => {
      const other = tempDir('analyzers');
      scaffoldEverything(other, stack);
      installAsPublished(other);

      expect(cli(other, 'depcruise-config', '--check').code).toBe(0);
      expect(findingsOf(other, ESLINT)).toBe('');
      expect(findingsOf(other, DEPCRUISE)).toBe('');
      expect(findingsOf(other, KNIP)).toBe('');
    }, 480_000);

    it('ESLint catches a generic error thrown by the domain', () => {
      write(root, SERVICE, `${service}\nexport function refuse(): never {\n  throw new Error('refused');\n}\n`);

      expect(findingsOf(root, ESLINT)).toContain('ddd-ts-kit/domain-no-generic-error');
    }, 120_000);

    it('dependency-cruiser catches a domain that imports its infrastructure', () => {
      write(root, SERVICE, `import '../../infrastructure/persistence/invoice.mapper.js';\n${service}`);

      expect(findingsOf(root, DEPCRUISE)).toContain('layer-domain-purity');
    }, 120_000);

    it('knip catches an export nothing uses', () => {
      write(root, SERVICE, `${service}\nexport const FORGOTTEN_RATE = 0.2;\n`);

      expect(findingsOf(root, KNIP)).toContain('FORGOTTEN_RATE');
    }, 120_000);
  });
});
