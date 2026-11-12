import { describe, expect, it } from 'vitest';
import { exists, read } from './helpers';
import { initProject } from './support/init-project';

const CLONE = 'test/support/test-database-clone.ts';
const RUN = 'test/support/test-database-run.ts';
const OPEN = 'src/platform/database/open-test-database.ts';

/** How each ORM connects to the copy, with the pool the run left the file, and what its `close` ends before the copy is dropped. */
const ON_THE_COPY = [
  [
    'drizzle',
    'const connection = connectToDatabase(clone.url, { poolSize: clone.poolSize });',
    'await connection.close();',
  ],
  [
    'knex',
    'const connection = connectToDatabase(clone.url, { poolSize: clone.poolSize });',
    'await connection.close();',
  ],
  ['prisma', 'const client = createClient(clone.url, { poolSize: clone.poolSize });', 'await client.$disconnect();'],
  [
    'typeorm',
    'const dataSource = createDataSource(clone.url, { poolSize: clone.poolSize });',
    'await persistence.close();',
  ],
] as const;

/** The tables each migration tool writes what it applied in: a run empties every other one. */
const KEPT = [
  ['drizzle', "const KEPT = '__drizzle_migrations';"],
  ['knex', "const KEPT = 'knex_migrations, knex_migrations_lock';"],
  ['prisma', "const KEPT = '_prisma_migrations';"],
  ['typeorm', "const KEPT = 'migrations, typeorm_metadata';"],
] as const;

describe('the test database of a project on a PostgreSQL server', () => {
  it.each(ON_THE_COPY)(
    'with %s, runs each call on a copy of its own, with its share of the connections, dropped once its connection is closed',
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

  it('opens a pool of the size it is given on Drizzle too, 10 by default', () => {
    const connect = read(initProject('--orm', 'drizzle'), 'src/platform/database/connect-to-database.ts');

    expect(connect).toContain('connectToDatabase(url: string, options: ConnectionOptions = {})');
    expect(connect).toContain('drizzle({ connection: { connectionString: url, max: options.poolSize ?? 10 } })');
  });

  it('names the copy in the configuration of the application under test, and what stands for a database in process', () => {
    const support = read(initProject(), 'test/e2e/support/start-application.ts');

    expect(support).toContain("testEnvironment({ DATABASE_URL: database.url ?? 'postgres://in-process/tests' })");
    expect(support).not.toContain('DATABASE_URL: url');
  });

  it('copies, for a file, the template its run made, one copy at a time, through the maintenance database', () => {
    const clone = read(initProject(), CLONE);
    const run = read(initProject(), RUN);

    expect(clone).toContain("const template = process.env[RUN_TEMPLATE] ?? '';");
    expect(clone).toContain('oneAtATime(server, run, () => server.query(copying(template, name)))');
    expect(clone).toContain('poolSize: Number(process.env[POOL_SIZE]),');
    expect(clone).toContain('drop: () => onServer(url, (server) => server.query(dropping(name))),');
    expect(clone).toContain('test/support/test-database-run.ts did not run on it.');
    expect(run).toContain("return 'create database ' + quoted(to) + ' template ' + quoted(from);");
    expect(run).toContain("return 'drop database if exists ' + quoted(name) + ' with (force)';");
    expect(run).toContain("return databaseOf(url) === 'postgres' ? 'template1' : 'postgres';");
    expect(run).toContain('await server.query(`select pg_advisory_lock(${COPYING}, ${keyOf(run)})`);');
  });

  it('copies the migrated database once per run, in the global setup, one run at a time, and empties the copy', () => {
    const run = read(initProject(), RUN);

    expect(run).toContain("await oneAtATime(server, '0', () => copied(server, databaseOf(url), template));");
    expect(run).toContain('const bytes = await emptied(url, template);');
    expect(run).toContain("execute 'truncate table ' || names || ' restart identity cascade'");
    // The guard of the audit trail refuses a truncate: off for the transaction that empties, on in every copy.
    expect(run).toContain("execute format('alter table %s disable trigger user', guarded);");
    expect(run).toContain("execute format('alter table %s enable trigger user', guarded);");
    expect(run).toContain("and d.deptype = 'e')");
    expect(run).toContain('process.env[RUN_TEMPLATE] = nameOf(url, run.id, TEMPLATE);');

    expect(run).toContain(
      'holds ${Math.round(bytes / (1024 * 1024))} MB of rows: copying it took ${seconds} s of this run',
    );

    expect(run).toContain('const LARGE = 64 * 1024 * 1024;');
  });

  it.each(KEPT)('on %s, leaves their rows to the tables of the migration tool', (orm, kept) => {
    expect(read(initProject('--orm', orm), RUN)).toContain(kept);
  });

  it('gives each file its share of the connections the server has left, and refuses with its numbers a run that does not fit', () => {
    const run = read(initProject(), RUN);

    expect(run).toContain('process.env[POOL_SIZE] = String(poolSizeFor(await connectionsLeft(server), workers));');
    expect(run).toContain('const each = Math.min(LARGEST_POOL, Math.floor(left / workers));');
    expect(run).toContain("current_setting('max_connections')::int as max,");
    expect(run).toContain('case when rolsuper then -1 else rolconnlimit end');
    expect(run).toContain("const ALLOWED = 'TEST_DATABASE_CONNECTIONS';");
    expect(run).toContain('`the server leaves ${left} (max_connections ${max}, ${reserved} reserved, ${used} open)`');

    expect(run).toContain(
      '${workers} spec files at once need ${workers * SMALLEST_POOL} connections, ${SMALLEST_POOL} each at least, and ${counted}: ${fewer}raise max_connections, or state what the run may take (${ALLOWED}).',
    );

    expect(run).toContain('run at most ${fitting} at once (pnpm run test:e2e --maxWorkers=${fitting}), ');
  });

  it('names what the server refuses: other sessions, a role that creates no database, a database absent, not migrated, or of another role', () => {
    const run = read(initProject(), RUN);

    expect(run).toContain("const OTHER_SESSIONS = '55006';");
    expect(run).toContain('if (codeOf(error) !== OTHER_SESSIONS) {');
    expect(run).toContain('return server.query(copying(database, template));');
    expect(run).toContain('PostgreSQL copies a database only while nobody else is connected to it.');
    expect(run).toContain("'42501': (database) =>");
    expect(run).toContain('(alter role <role> createdb)');
    expect(run).toContain("'3D000': (database) =>");
    expect(run).toContain('holds no table: migrate it first (pnpm run db:migrate).');
    expect(run).toContain('could not be emptied (${String(error)}): the role of DATABASE_URL owns its tables');
  });

  it('drops what a run that died left: named after a run, its lock free, and nobody connected', () => {
    const run = read(initProject(), RUN);

    expect(run).toContain("const MARKER = '_test_';");
    expect(run).toContain('return /^([0-9a-f]{8})_(?:template|[0-9a-f]{8})$/.exec(rest)?.[1];');
    // The lock is taken before any database carries the name of the run, and held until its end.
    expect(run).toContain('const run = { server, url, id: await lockedRun(server) };');
    expect(run).toContain('locked(run.server, `pg_try_advisory_lock(${LIVE}, ${keyOf(dead)})`)');
    expect(run).toContain("await run.server.query('drop database if exists ' + quoted(name)).catch(() => undefined);");
    expect(run).toContain('await locked(run.server, `pg_advisory_unlock(${LIVE}, ${keyOf(dead)})`);');
    // At its end a run drops what is its own, the copy of a file that failed while it started included.
    expect(run).toContain('if (runOf(name, run.url) === run.id) {\n      await run.server.query(dropping(name));');
  });

  it('is written with Jest too, not without an ORM, and its global setup only where there is an end-to-end run', () => {
    expect(exists(initProject('--tests', 'jest', '--orm', 'typeorm'), CLONE)).toBe(true);
    expect(exists(initProject('--tests', 'jest', '--orm', 'typeorm'), RUN)).toBe(true);
    expect(exists(initProject('--orm', 'none'), CLONE)).toBe(false);
    expect(exists(initProject('--orm', 'none'), RUN)).toBe(false);
    expect(exists(initProject('--http', 'none'), RUN)).toBe(false);
  });
});

describe('the global setup of an end-to-end run on a server', () => {
  it('with Vitest, starts the run for the workers of the project when DATABASE_URL is set, and resolves its end', () => {
    const run = read(initProject(), RUN);

    expect(run).toContain("import type { TestProject } from 'vitest/node';");
    expect(run).toContain('export async function setup(project: TestProject): Promise<() => Promise<void>> {');
    expect(run).toContain("return url === '' ? () => Promise.resolve() : startRun(url, project.config.maxWorkers);");
    expect(run).not.toContain('export default');
  });

  it('with Jest, is a default export that imports nothing of the project, and the teardown finds the end of the run', () => {
    const root = initProject('--tests', 'jest');
    const run = read(root, RUN);
    const teardown = read(root, 'test/support/test-database-teardown.ts');

    expect(run).toContain(
      'export default async function setup(jest: { readonly maxWorkers: number }): Promise<void> {',
    );

    expect(run).toContain("await startRun(process.env['DATABASE_URL'] ?? '', jest.maxWorkers);");
    expect(run).not.toContain('vitest');
    expect(run.match(/^import .*$/gm)).toEqual(["import { randomBytes } from 'node:crypto';", "import pg from 'pg';"]);
    expect(run).toContain("const END = Symbol.for('ddd-ts-kit.test-database-run');");
    expect(run).toContain('Reflect.set(globalThis, END, end);');
    expect(teardown).toContain("Reflect.get(globalThis, Symbol.for('ddd-ts-kit.test-database-run'));");
    expect(teardown).toContain('await Reflect.apply(end, undefined, []);');
    expect(teardown).not.toMatch(/from '[.$@]/);
  });

  it('is an entry for knip under Jest, whose configuration names it only when DATABASE_URL is set', () => {
    const entry = '"test/support/test-database-run.ts"';

    expect(read(initProject('--tests', 'jest'), 'knip.json')).toContain(`"test/e2e/**/*.e2e.spec.ts",\n      ${entry}`);
    expect(read(initProject('--tests', 'jest', '--orm', 'none'), 'knip.json')).not.toContain(entry);
    expect(read(initProject('--tests', 'jest', '--http', 'none'), 'knip.json')).not.toContain(entry);
    // The configuration of Vitest names it whatever the environment: its plugin finds it there.
    expect(read(initProject(), 'knip.json')).not.toContain(entry);
  });
});

describe('the files of an end-to-end run with Vitest', () => {
  it('run at the same time whatever DATABASE_URL, each on a database of its own, after both global setups', () => {
    const config = read(initProject('--orm', 'prisma'), 'vitest.e2e.config.ts');

    expect(config).toContain('a copy of the one\n// DATABASE_URL names (test/support/test-database-clone.ts)');
    expect(config).toMatch(/on a server too\.\nexport default defineConfig\(\{/);
    expect(config).not.toContain('fileParallelism');

    expect(config).toContain(
      "globalSetup: ['test/support/test-database-template.ts', 'test/support/test-database-run.ts'],",
    );
  });

  it('run at the same time without an ORM, where each application keeps what it stores', () => {
    const config = read(initProject('--orm', 'none'), 'vitest.e2e.config.ts');

    expect(config).toContain('which keeps what it stores in its own memory');
    expect(config).not.toContain('DATABASE_URL');
    expect(config).not.toContain('fileParallelism');
    expect(config).not.toContain('globalSetup');
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
  it('are two whatever DATABASE_URL, each replaced once it grew, and the global setup is the one of the server when it is set', () => {
    const config = read(initProject('--tests', 'jest', '--orm', 'prisma'), 'jest.e2e.config.js');

    expect(config).toContain('  maxWorkers: 2,\n');
    expect(config).toContain("workerIdleMemoryLimit: '800MB',");
    expect(config).not.toContain('sharedServer');
    expect(config).toContain("import process from 'node:process';");

    expect(config).toContain(
      "...((process.env.DATABASE_URL ?? '') === '' ? {} : { globalSetup: '<rootDir>/test/support/test-database-run.ts' }),",
    );
  });

  it('name no global setup of a server, and import nothing more, without an ORM', () => {
    const config = read(initProject('--tests', 'jest', '--orm', 'none'), 'jest.e2e.config.js');

    expect(config).not.toContain('globalSetup');
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
    expect(config.match(/import process from 'node:process';/g)).toHaveLength(1);
  });
});

/** Drizzle and Knex close in the object they return, Prisma and TypeORM in a function above it. */
function closingIndent(orm: string): string {
  return orm === 'drizzle' || orm === 'knex' ? '\n      ' : '\n    ';
}
