import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cli, read, REPO_ROOT, scaffoldEverything, tempDir, walk, write, type StackFlags } from './helpers.js';

interface CheckJson {
  ok: boolean;
  errors: number;
  warnings: number;
  files: number;
  violations: unknown[];
}

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
            '@ddd-ts-kit/validation': [workspace('validation')],
            '@ddd-ts-kit/validation/*': [workspace('validation', '*')],
            '@ddd-ts-kit/http': [workspace('http')],
            '@ddd-ts-kit/http/*': [workspace('http', '*')],
            '@ddd-ts-kit/tracing': [workspace('tracing')],
            '@ddd-ts-kit/tracing/*': [workspace('tracing', '*')],
            '@ddd-ts-kit/di': [workspace('di')],
            '@ddd-ts-kit/events': [workspace('events')],
            '@ddd-ts-kit/events/*': [workspace('events', '*')],
            '@ddd-ts-kit/testing': [workspace('testing')],
            '@ddd-ts-kit/testing/*': [workspace('testing', '*')],
            '@ddd-ts-kit/drizzle/*': [workspace('drizzle', '*')],
            '@ddd-ts-kit/knex': [workspace('knex')],
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

  function runIn(root: string, command: string, args: readonly string[]): string {
    try {
      return execFileSync(command, [...args], { cwd: root, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, DATABASE_URL: '', OTEL_SDK_DISABLED: 'true', NO_COLOR: '1', FORCE_COLOR: '0' } });
    } catch (error) {
      const output = error instanceof Error && 'stdout' in error ? `${String(error.stdout)}\n${String(Reflect.get(error, 'stderr'))}` : String(error);
      throw new Error(`${command} ${args.join(' ')} failed:\n${output}`, { cause: error });
    }
  }

  it('passes its own specs (PGlite adapter contract included), its end-to-end specs, its build and its documentation checks', () => {
    const root = tempDir('run');
    scaffoldEverything(root);
    fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(root, 'node_modules'), 'dir');

    const specs = runIn(root, bin('vitest'), ['run']);
    expect(specs).toMatch(/Test Files\s+\d+ passed/);
    expect(specs).not.toContain('failed');
    expect(fs.existsSync(path.join(root, 'src/contexts/billing/test/integration/invoice.repository.contract.spec.ts'))).toBe(true);

    const endToEnd = runIn(root, bin('vitest'), ['run', '--config', 'vitest.e2e.config.ts']);
    expect(endToEnd).toMatch(/Tests\s+2 passed/);

    runIn(root, process.execPath, [NATIVE_COMPILER, '-p', 'tsconfig.build.json']);
    runIn(root, process.execPath, ['dist/scripts/openapi.js']);
    runIn(root, process.execPath, ['dist/scripts/events.js']);
    runIn(root, process.execPath, ['dist/scripts/openapi.js', '--check']);
    runIn(root, process.execPath, ['dist/scripts/events.js', '--check']);
    expect(walk(root, 'docs/integration')).toEqual(['docs/integration/README.md', 'docs/integration/asyncapi.json', 'docs/integration/event-catalog.md']);
    expect(fs.readFileSync(path.join(root, 'docs/integration/event-catalog.md'), 'utf8')).toContain('Consumers: `shipping`');
    expect(cli(root, 'check').code).toBe(0);
    expect(cli(root, 'docs', '--check').code).toBe(0);
  }, 180_000);

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
