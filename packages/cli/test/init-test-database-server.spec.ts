import { describe, expect, it } from 'vitest';
import { exists, read } from './helpers';
import { initProject } from './support/init-project';

const CLONE = 'test/support/test-database-clone.ts';
const OPEN = 'src/platform/database/open-test-database.ts';

/** How each ORM connects to the copy, and what its `close` ends before the copy is dropped. */
const ON_THE_COPY = [
  ['drizzle', 'const connection = connectToDatabase(clone.url);', 'await connection.close();'],
  ['knex', 'const connection = connectToDatabase(clone.url);', 'await connection.close();'],
  ['prisma', 'const client = createClient(clone.url);', 'await client.$disconnect();'],
  ['typeorm', 'const dataSource = createDataSource(clone.url);', 'await persistence.close();'],
] as const;

describe('the test database of a project on a PostgreSQL server', () => {
  it.each(ON_THE_COPY)(
    'with %s, runs each call on a copy of the migrated database, dropped once its connection is closed',
    (orm, connecting, closing) => {
      const open = read(initProject('--orm', orm), OPEN);

      expect(open).toContain("import { cloneDatabase } from '$test/support/test-database-clone';");
      expect(open).toContain(`const clone = await cloneDatabase(url);\n  ${connecting}`);
      expect(open).toContain(`${closing}\n      await clone.drop();`.replace('\n      ', closingIndent(orm)));
      expect(open).toContain('  readonly url?: string;');
      expect(open).toMatch(/return \{\n? *url: clone\.url,/);
      // Nothing connects to the database the URL names: it is only copied.
      expect(open).not.toMatch(/(?:connectToDatabase|createClient|createDataSource)\(url\)/);
    },
  );

  it('names the copy in the configuration of the application under test, and what stands for a database in process', () => {
    const support = read(initProject(), 'test/e2e/support/start-application.ts');

    expect(support).toContain("testEnvironment({ DATABASE_URL: database.url ?? 'postgres://in-process/tests' })");
    expect(support).not.toContain('DATABASE_URL: url');
  });

  it('copies through the maintenance database, so that the files that start together are no session of the copied one', () => {
    const clone = read(initProject(), CLONE);

    expect(clone).toContain("const statement = 'create database ' + quoted(name) + ' template ' + quoted(database);");
    expect(clone).toContain('connectionString: urlOf(url, maintenanceDatabaseOf(url))');
    expect(clone).toContain("return databaseOf(url) === 'postgres' ? 'template1' : 'postgres';");
    expect(clone).toContain("'drop database if exists ' + quoted(name) + ' with (force)'");
  });

  it('names what the server refuses: other sessions, a role that creates no database, a database absent or not migrated', () => {
    const clone = read(initProject(), CLONE);

    expect(clone).toContain("const OTHER_SESSIONS = '55006';");
    expect(clone).toContain('if (codeOf(error) !== OTHER_SESSIONS) {');
    expect(clone).toContain('return server.query(statement);');
    expect(clone).toContain('PostgreSQL copies a database only while nobody else is connected to it.');
    expect(clone).toContain("'42501': (database) =>");
    expect(clone).toContain('(alter role <role> createdb)');
    expect(clone).toContain("'3D000': (database) =>");
    expect(clone).toContain('holds no table: migrate it first (pnpm run db:migrate).');
  });

  it('drops the copies a killed run left, and only what carries the name of a copy with a date an hour old', () => {
    const clone = read(initProject(), CLONE);

    expect(clone).toContain("const MARKER = '_test_';");
    expect(clone).toContain('const LEFTOVER_AFTER_SECONDS = 3600;');
    expect(clone).toContain('if (created !== undefined && created < oldest) {');

    expect(clone).toContain(
      'return /^\\d{10}$/.test(seconds) && /^[0-9a-f]{8}$/.test(random) ? Number(seconds) : undefined;',
    );
  });

  it('is written with Jest too, and not without an ORM', () => {
    expect(exists(initProject('--tests', 'jest', '--orm', 'typeorm'), CLONE)).toBe(true);
    expect(exists(initProject('--orm', 'none'), CLONE)).toBe(false);
  });
});

describe('the files of an end-to-end run with Vitest', () => {
  it('run at the same time whatever DATABASE_URL, each on a database of its own', () => {
    const config = read(initProject('--orm', 'prisma'), 'vitest.e2e.config.ts');

    expect(config).toContain('a copy of the one\n// DATABASE_URL names (test/support/test-database-clone.ts)');
    expect(config).toMatch(/on a server too\.\nexport default defineConfig\(\{/);
    expect(config).not.toContain('fileParallelism');
  });

  it('run at the same time without an ORM, where each application keeps what it stores', () => {
    const config = read(initProject('--orm', 'none'), 'vitest.e2e.config.ts');

    expect(config).toContain('which keeps what it stores in its own memory');
    expect(config).not.toContain('DATABASE_URL');
    expect(config).not.toContain('fileParallelism');
  });

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
});

describe('the workers of an end-to-end run with Jest', () => {
  it('are two whatever DATABASE_URL, each replaced once it grew', () => {
    const config = read(initProject('--tests', 'jest', '--orm', 'prisma'), 'jest.e2e.config.js');

    expect(config).toContain('  maxWorkers: 2,\n');
    expect(config).toContain("workerIdleMemoryLimit: '800MB',");
    expect(config).not.toContain('sharedServer');
    expect(config).not.toContain("from 'node:process'");
  });

  it('are one, in band, on a broker or a Redis server every file would share', () => {
    const flags = ['--tests', 'jest', '--broker', 'rabbitmq', '--cache', 'redis'];
    const config = read(initProject(...flags), 'jest.e2e.config.js');

    expect(config).toContain(
      "const sharedServer = (process.env.AMQP_URL ?? '') !== '' || (process.env.REDIS_URL ?? '') !== '';",
    );

    expect(config).toContain('with AMQP_URL or REDIS_URL set, one worker');
    expect(config).toContain('  maxWorkers: sharedServer ? 1 : 2,\n');
    expect(config).toContain("import process from 'node:process';");
  });
});

/** Drizzle and Knex close in the object they return, Prisma and TypeORM in a function above it. */
function closingIndent(orm: string): string {
  return orm === 'drizzle' || orm === 'knex' ? '\n      ' : '\n    ';
}
