import { describe, expect, it } from 'vitest';
import { exists, read } from './helpers';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';

const SETUP = 'test/support/test-database-setup.ts';

describe('the global setup of an end-to-end run on a server', () => {
  it('with Vitest, opens the run for the files that run at once, no more than the spec files, and resolves its end', () => {
    const root = initProject('--orm', 'prisma');
    const setup = read(root, SETUP);
    const config = read(root, 'vitest.e2e.config.ts');

    expect(setup).toContain('export async function setup(project: TestProject): Promise<() => Promise<void>> {');
    expect(setup).toContain('const run = await openRun(url, await filesAtOnce(project));');
    expect(setup).toContain('const files = watch ? maxWorkers : (await project.globTestFiles()).testFiles.length;');
    expect(setup).toContain('return Math.max(1, Math.min(maxWorkers, files));');
    expect(setup).toContain('process.env[RUN_TEMPLATE] = run.template;');
    expect(setup).not.toContain('export default');

    expect(config).toContain(
      "globalSetup: ['test/support/test-database-template.ts', 'test/support/test-database-setup.ts'],",
    );

    expect(config).not.toContain('fileParallelism');
  });

  it('with Jest, counts the spec files the command line asks for, saves the cluster in process without a server, and leaves its end to the teardown', () => {
    const root = initProject('--tests', 'jest');
    const setup = read(root, SETUP);
    const teardown = read(root, 'test/support/test-database-teardown.ts');

    expect(setup).toContain('export default async function setup(jest: JestRun): Promise<void> {');
    expect(setup).toContain("import saveCluster from '$test/support/test-database-template';");
    expect(setup).toContain("if (url === '') {\n    await saveCluster();");
    expect(setup).toContain('const run = await openRun(url, filesAtOnce(jest));');
    expect(setup).toContain('return Math.max(1, Math.min(maxWorkers, files.length));');
    expect(setup).toContain('Reflect.set(globalThis, END, run.end);');
    expect(teardown).toContain("Reflect.get(globalThis, Symbol.for('ddd-ts-kit.test-database-run'));");
    expect(teardown).toContain('await Reflect.apply(end, undefined, []);');
    // The unit run loads the teardown with the resolution of Node: it imports nothing of the project.
    expect(teardown).not.toMatch(/from '[.$@]/);
  });

  it('with Jest, is named by the configuration, whose scripts start Jest under tsx so that its imports by alias resolve', () => {
    const root = initProject('--tests', 'jest', '--orm', 'prisma');
    const config = read(root, 'jest.e2e.config.js');
    const scripts = jsonAt(JSON.parse(read(root, 'package.json')), 'scripts');

    const underTsx =
      'node --import tsx --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.e2e.config.js --passWithNoTests';

    expect(config).toContain("  globalSetup: '<rootDir>/test/support/test-database-setup.ts',\n");
    expect(config).toContain('  maxWorkers: 2,\n');
    expect(config).not.toContain("from 'node:process'");
    expect(jsonAt(scripts, 'test:e2e')).toBe(underTsx);
    expect(jsonAt(scripts, 'ci:test:e2e')).toBe(underTsx);
    expect(jsonAt(scripts, 'test')).toBe('node --experimental-vm-modules node_modules/jest/bin/jest.js');
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
