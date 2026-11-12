import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, exists, read } from './helpers';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';

const SETUP = 'test/support/test-database-setup.ts';

describe('the global setup of an end-to-end run on a server', () => {
  it('with Vitest, opens the run for the files that run at once, no more than the runner lists for this run, and resolves its end', () => {
    const root = initProject('--orm', 'prisma');
    const setup = read(root, SETUP);
    const config = read(root, 'vitest.e2e.config.ts');

    expect(setup).toContain('export async function setup(project: TestProject): Promise<() => Promise<void>> {');
    expect(setup).toContain('const run = await openRun(url, filesAtOnce(project));');
    expect(setup).toContain('const listed = project.vitest.state.getPaths().length;');

    expect(setup).toContain(
      'const files = watch || listed === 0 ? maxWorkers : Math.ceil(listed / (shard?.count ?? 1));',
    );

    expect(setup).toContain('return Math.max(1, Math.min(maxWorkers, files));');
    expect(setup).toContain('process.env[RUN_TEMPLATE] = run.template;');
    expect(setup).not.toContain('export default');

    expect(config).toContain(
      "globalSetup: ['test/support/test-database-template.ts', 'test/support/test-database-setup.ts'],",
    );

    expect(config).not.toContain('fileParallelism');
  });

  it('with Jest, counts no fewer spec files than the run has, saves the cluster in process without a server, and leaves its end to the teardown', () => {
    const root = initProject('--tests', 'jest');
    const setup = read(root, SETUP);
    const teardown = read(root, 'test/support/test-database-teardown.ts');

    expect(setup).toContain(
      'export default async function setup(jest: JestRun, project: JestProject): Promise<void> {',
    );

    expect(setup).toContain("if (url === '') {\n    await saveCluster();");
    expect(setup).toContain('const run = await openRun(url, filesAtOnce(jest, project));');
    expect(setup).toContain('} catch {\n    return jest.maxWorkers;\n  }');

    // No spec file found under test/ is no count: the workers, as with Vitest, never one file.
    expect(setup).toContain(
      'const files = listed === 0 ? jest.maxWorkers : Math.ceil(listed / (jest.shard?.shardCount ?? 1));',
    );

    expect(setup).toContain('pattern.test(file) || pattern.test(whole(file))');
    expect(setup).toContain('Reflect.set(globalThis, END, run.end);');
    expect(teardown).toContain("Reflect.get(globalThis, Symbol.for('ddd-ts-kit.test-database-run'));");
    expect(teardown).toContain('await Reflect.apply(end, undefined, []);');
    // The unit run loads the teardown with the resolution of Node: it imports nothing of the project.
    expect(teardown).not.toMatch(/from '[.$@]/);
  });

  it('with Jest, is named by the configuration and started by Jest alone, as an editor or `npx jest` starts it', () => {
    const root = initProject('--tests', 'jest', '--orm', 'prisma');
    const config = read(root, 'jest.e2e.config.js');
    const scripts = jsonAt(JSON.parse(read(root, 'package.json')), 'scripts');
    const plain = 'node --experimental-vm-modules node_modules/jest/bin/jest.js';

    expect(config).toContain("  globalSetup: '<rootDir>/test/support/test-database-setup.ts',\n");
    expect(config).toContain('  maxWorkers: 2,\n');
    expect(config).not.toContain("from 'node:process'");
    expect(jsonAt(scripts, 'test:e2e')).toBe(`${plain} --config jest.e2e.config.js --passWithNoTests`);
    expect(jsonAt(scripts, 'ci:test:e2e')).toBe(`${plain} --config jest.e2e.config.js --passWithNoTests`);
    expect(jsonAt(scripts, 'test')).toBe(plain);
  });

  it.each([
    ['vitest', 'drizzle'],
    ['jest', 'knex'],
    ['jest', 'prisma'],
    ['vitest', 'typeorm'],
  ])(
    'with %s on %s, is loaded with what it imports before any alias exists: by a relative path of test/support',
    (tests, orm) => {
      const root = initProject('--tests', tests, '--orm', orm);
      const support = fs.readdirSync(path.join(root, 'test/support')).map((file) => read(root, `test/support/${file}`));

      const imports = support.flatMap((source) =>
        [...source.matchAll(/from '([^']+)'/g)].map(([, specifier]) => specifier),
      );

      expect(imports.filter((specifier) => /^[$@]\//.test(specifier ?? ''))).toEqual([]);
      expect(imports).toContain('./test-database-run');
      expect(read(root, SETUP)).toContain("import { openRun } from './test-database-run';");
    },
  );

  it('under "importExtension": "js", names its neighbours by the .ts of their source, which the type check alone is let read', () => {
    const root = initProject('--tests', 'jest', '--import-extension', 'js');
    const options = Object(jsonAt(JSON.parse(read(root, 'tsconfig.json')), 'compilerOptions')) as object;
    const build: unknown = JSON.parse(read(root, 'tsconfig.build.json'));

    expect(read(root, SETUP)).toContain("import { openRun } from './test-database-run.ts';");
    expect(read(root, 'test/support/test-database-run.ts')).toContain("from './test-database-server.ts';");
    expect(options).toMatchObject({ allowImportingTsExtensions: true, noEmit: true });
    // The build emits what it emitted before: no option that rewrites an import, and so no helper in the compiled output.
    expect(Object.keys(options)).not.toContain('rewriteRelativeImportExtensions');
    expect(jsonAt(build, 'compilerOptions')).toEqual({ allowImportingTsExtensions: false, noEmit: false });

    expect(cli(root, 'check', '--rule', 'imports/alias-declared', '--rule', 'imports/alias-only').stdout).toContain(
      '0 errors',
    );
  });

  it('without an extension, asks nothing more of the compiler: neither configuration names an option for it', () => {
    const root = initProject();

    expect(
      Object.keys(Object(jsonAt(JSON.parse(read(root, 'tsconfig.json')), 'compilerOptions')) as object).filter(
        (option) => /noEmit|TsExtensions|ImportExtensions/.test(option),
      ),
    ).toEqual([]);

    expect(Object.keys(Object(JSON.parse(read(root, 'tsconfig.build.json'))) as object)).toEqual([
      'extends',
      'exclude',
    ]);
  });

  it('is written where there is an end-to-end run on a database, and Jest starts as before without one', () => {
    const memory = initProject('--tests', 'jest', '--orm', 'none');

    expect(exists(initProject('--http', 'none'), SETUP)).toBe(false);
    expect(exists(memory, SETUP)).toBe(false);
    expect(read(memory, 'jest.e2e.config.js')).not.toContain('globalSetup');
    expect(jsonAt(jsonAt(JSON.parse(read(memory, 'package.json')), 'scripts'), 'test:e2e')).not.toContain('tsx');
    expect(read(initProject('--orm', 'none'), 'vitest.e2e.config.ts')).not.toContain('globalSetup');
  });
});

describe('the files of an end-to-end run with Vitest', () => {
  it.each([
    [['--broker', 'rabbitmq'], "(process.env['AMQP_URL'] ?? '') === ''", 'A broker is one for every file'],
    [['--broker', 'kafka'], "(process.env['KAFKA_BROKERS'] ?? '') === ''", 'with KAFKA_BROKERS set'],
    [['--broker', 'nats'], "(process.env['NATS_URL'] ?? '') === ''", 'consume the events of the others'],
    [['--cache', 'redis'], "(process.env['REDIS_URL'] ?? '') === ''", 'which would read the keys of the others'],
    [['--broker', 'redis'], "(process.env['REDIS_URL'] ?? '') === ''", 'consume the events and read the keys'],
    [
      ['--broker', 'rabbitmq', '--cache', 'redis'],
      "(process.env['AMQP_URL'] ?? '') === '' && (process.env['REDIS_URL'] ?? '') === ''",
      'A broker and a Redis server are one for every file',
    ],
  ])('with %j, run one after the other on the server every file would share', (flags, apart, reason) => {
    const config = read(initProject(...flags), 'vitest.e2e.config.ts');

    expect(config).toContain(`    fileParallelism: ${apart},\n`);
    expect(config).toContain(reason);
  });

  it('run at the same time without an ORM, where each application keeps what it stores', () => {
    const config = read(initProject('--orm', 'none'), 'vitest.e2e.config.ts');

    expect(config).toContain('which keeps what it stores in its own memory');
    expect(config).not.toContain('DATABASE_URL');
  });
});

describe('the workers of an end-to-end run with Jest', () => {
  it('are one, in band, on a broker or a Redis server every file would share', () => {
    const flags = ['--tests', 'jest', '--broker', 'rabbitmq', '--cache', 'redis'];
    const config = read(initProject(...flags), 'jest.e2e.config.js');

    expect(config).toContain(
      "const sharedServer = (process.env.AMQP_URL ?? '') !== '' || (process.env.REDIS_URL ?? '') !== '';",
    );

    expect(config).toContain('with AMQP_URL or REDIS_URL set, one worker');
    expect(config).toContain('  maxWorkers: sharedServer ? 1 : 2,\n');
    expect(config).toContain("import process from 'node:process';");
    expect(config).toContain("workerIdleMemoryLimit: '800MB',");
  });
});
