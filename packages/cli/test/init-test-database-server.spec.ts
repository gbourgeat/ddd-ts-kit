import { describe, expect, it } from 'vitest';
import { cli, exists, read, write } from './helpers';
import { commitAll } from './support/commit-all';
import { initProject } from './support/init-project';

const OPEN = 'src/platform/database/open-test-database.ts';
const PARTS = ['clone', 'run', 'session', 'leftovers', 'budget', 'emptying', 'server', 'kept'];

const support = (root: string, part: string): string => read(root, `test/support/test-database-${part}.ts`);

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

/** The tables each migration tool writes what it applied in: listed as kept when the project is generated. */
const KEPT = [
  ['drizzle', "  'drizzle.__drizzle_migrations',\n"],
  ['knex', "  'public.knex_migrations',\n  'public.knex_migrations_lock',\n"],
  ['prisma', "  'public._prisma_migrations',\n"],
  ['typeorm', "  'public.migrations',\n  'public.typeorm_metadata',\n"],
] as const;

describe('the test database of a project on a PostgreSQL server', () => {
  it.each(ON_THE_COPY)(
    'with %s, runs each call on a copy of its own, with its share of the connections, dropped once its connection is closed',
    (orm, connecting, closing) => {
      const open = read(initProject('--orm', orm), OPEN);

      expect(open).toContain("import { cloneDatabase } from '$test/support/test-database-clone';");
      expect(open).toContain(`const clone = await cloneDatabase(url);\n  ${connecting}`);
      expect(open).toContain(`${closing}\n      await clone.drop();`.replace('\n      ', closingIndent(orm)));
      expect(open).toMatch(/return \{\n? *url: clone\.url,/);
      // Nothing connects to the database the URL names: it is only copied.
      expect(open).not.toMatch(/(?:connectToDatabase|createClient|createDataSource)\(url\)/);
      expect(open).toContain('any other caller\n * copies the migrated database itself.');
    },
  );

  it('opens a pool of the size it is given on Drizzle too, 10 by default', () => {
    const connect = read(initProject('--orm', 'drizzle'), 'src/platform/database/connect-to-database.ts');

    expect(connect).toContain('connectToDatabase(url: string, options: ConnectionOptions = {})');
    expect(connect).toContain('drizzle({ connection: { connectionString: url, max: options.poolSize ?? 10 } })');
  });

  it('names the copy in the configuration of the application under test, and what stands for a database in process', () => {
    const application = read(initProject(), 'test/e2e/support/start-application.ts');

    expect(application).toContain("testEnvironment({ DATABASE_URL: database.url ?? 'postgres://in-process/tests' })");
  });

  it('is written in parts no longer than a file may be, with Jest too, and without an HTTP stack, not without an ORM', () => {
    for (const root of [
      initProject(),
      initProject('--tests', 'jest', '--orm', 'typeorm'),
      initProject('--http', 'none'),
    ]) {
      for (const part of PARTS) {
        expect(support(root, part).split('\n').length, part).toBeLessThan(200);
      }
    }

    expect(exists(initProject('--orm', 'none'), 'test/support/test-database-clone.ts')).toBe(false);
    expect(exists(initProject('--orm', 'none'), 'test/support/test-database-kept.ts')).toBe(false);
  });
});

describe('the database of a caller, on a server', () => {
  it('is a copy of the template of the run its global setup started, one copy at a time', () => {
    const clone = support(initProject(), 'clone');
    const server = support(initProject(), 'server');

    expect(clone).toContain("const template = process.env[RUN_TEMPLATE] ?? '';");
    expect(clone).toContain('oneAtATime(server, run, () => server.query(copying(template, name)))');
    expect(clone).toContain('poolSize: Number(process.env[POOL_SIZE]),');
    expect(clone).toContain('drop: () => onServer(url, (server) => server.query(dropping(name))),');
    expect(server).toContain("return 'create database ' + quoted(to) + ' template ' + quoted(from);");
    expect(server).toContain("return 'drop database if exists ' + quoted(name) + force;");
    expect(server).toContain('await server.query(`select pg_advisory_lock(${COPYING}, ${keyOf(run)})`);');
  });

  it('is a run of its own where no global setup started one: a spec of the unit run, a project with no end-to-end run', () => {
    const clone = support(initProject('--http', 'none', '--orm', 'typeorm'), 'clone');

    expect(clone).toContain('if (run === undefined) {\n    return runOfItsOwn(url);\n  }');
    expect(clone).toContain('const run = await openRun(url, 1);');
    expect(clone).toContain('return { url: urlOf(url, run.template), poolSize: run.poolSize, drop: run.end };');
  });

  it('is never the database "postgres", where the runs hold their locks', () => {
    const server = support(initProject(), 'server');

    expect(server).toContain(
      "export async function connectedTo(url: string, database = 'postgres'): Promise<pg.Client> {",
    );

    expect(server).toContain("if (databaseOf(url) === 'postgres') {");
    expect(server).toContain('give the tests a database of their own (create database <name>');
  });
});

describe('a run on a server', () => {
  it('takes its lock, drops what died, checks its connections, copies the migrated database once and empties the copy', () => {
    const run = support(initProject(), 'run');

    expect(run).toContain('const session = await openSession(url, tell);');
    expect(run).toContain('await dropLeftovers(session.server(), url, session.id);');
    expect(run).toContain('const poolSize = await poolSizeFor(session.server(), atOnce);');

    expect(run).toContain(
      "await oneAtATime(session.server(), '0', () => copied(session.server(), databaseOf(url), template));",
    );

    expect(run).toContain('await session.beatOn(template);');

    expect(run).toContain(
      'tell(said(await emptied(url, template), databaseOf(url), Math.ceil((Date.now() - from) / 1000)));',
    );
  });

  it('names what the server refuses: other sessions, a role that creates no database, a database absent or not migrated', () => {
    const run = support(initProject(), 'run');

    expect(run).toContain("const OTHER_SESSIONS = '55006';");
    expect(run).toContain('return server.query(copying(database, template));');
    expect(run).toContain('PostgreSQL copies a database only while nobody else is connected to it.');
    expect(run).toContain('(alter role <role> createdb)');
    expect(run).toContain("'3D000': (database) =>");
    expect(support(initProject(), 'emptying')).toContain('holds no table: migrate it first (pnpm run db:migrate).');
  });

  it('ends on its session or, when the server ended that one, on another, and never throws', () => {
    const run = support(initProject(), 'run');

    expect(run).toContain(
      'await dropOwn(session.server())\n    .catch(() => onServer(url, dropOwn))\n    .catch(() => undefined);',
    );

    expect(run).toContain('rows.filter((row) => runOf(row.datname, url) === session.id)');
  });

  it('says what it emptied that held rows, what it left to another role, and what a large copy took', () => {
    const run = support(initProject(), 'run');

    expect(run).toContain(
      'The run emptied ${held.length} table(s) of its copy of "${database}" that held rows (${named(held)})',
    );

    expect(run).toContain('It left ${ofAnotherRole.length} table(s) with their rows, which another role owns');
    expect(run).toContain('copying them took ${seconds} s of this run.');
    expect(run).toContain('const LARGE = 64 * 1024 * 1024;');
  });
});

describe('the session of a run', () => {
  it('holds the lock of a name taken before any database carries it, and takes both again when the server ends it', () => {
    const session = support(initProject(), 'session');

    expect(session).toContain('held.id = await lockedRun(held.client);');
    expect(session).toContain("client.on('error', () => {");
    expect(session).toContain('if (held.client === client && !held.retaking && !held.ended) {');
    expect(session).toContain('if (!(await locked(client, `pg_try_advisory_lock(${LIVE}, ${keyOf(held.id)})`))) {');
    expect(session).toContain('The run lost its session on the server and could not take it again');
    expect(session).toContain('await held.client.end().catch(() => undefined);');
  });

  it('says every 15 seconds, in the comment of its template, that the run lives', () => {
    const session = support(initProject(), 'session');

    expect(session).toContain('const BEAT_SECONDS = 15;');
    expect(session).toContain('export const DEAD_AFTER_SECONDS = 60;');

    expect(session).toContain(
      "execute format('comment on database %I is %L', ${name}, '${BEAT}' || extract(epoch from now())::bigint);",
    );

    expect(session).toContain('held.beating.unref();');
  });
});

describe('what a run drops of the runs before it', () => {
  it('is named after a run whose lock is free and that has not said for a minute that it lives, with nobody connected', () => {
    const leftovers = support(initProject(), 'leftovers');

    expect(support(initProject(), 'server')).toContain(
      'return /^([0-9a-f]{8})_(?:template|[0-9a-f]{8})$/.exec(rest)?.[1];',
    );

    expect(leftovers).toContain(
      'const left = rows.filter(({ name }) => ![undefined, own].includes(runOf(name, url)));',
    );

    expect(leftovers).toContain(
      'if (!lives(ofTheRun) && (await locked(server, `pg_try_advisory_lock(${LIVE}, ${keyOf(run)})`))) {',
    );

    expect(leftovers).toContain('for (const { name } of ofTheRun.filter((database) => !database.connected)) {');
    expect(leftovers).toContain("await server.query(dropping(name, '')).catch(() => undefined);");
    expect(leftovers).toContain('return Number(now) - last < DEAD_AFTER_SECONDS;');
  });
});

describe('the connections of a run', () => {
  it('are what the tightest bound leaves, shared between the files at once, one to spare for each', () => {
    const budget = support(initProject(), 'budget');

    expect(budget).toContain('const SPARE = 1;');
    expect(budget).toContain('return Math.min(LARGEST_POOL, Math.floor(left / atOnce) - SPARE);');
    expect(budget).toContain("current_setting('max_connections')::int as max,");
    expect(budget).toContain('case when rolsuper then -1 else rolconnlimit end');
  });

  it('are refused with the numbers of the bound that holds them, and what raises that one', () => {
    const budget = support(initProject(), 'budget');

    expect(budget).toContain("remedy: 'raise max_connections',");
    expect(budget).toContain('remedy: `raise the limit of the role (alter role ${role} connection limit <more>)`,');
    expect(budget).toContain('remedy: `state more in ${STATED} (${ofTheServer.left} at most)`,');
    expect(budget).toContain('run at most ${fitting} at once (pnpm run test:e2e --maxWorkers=${fitting}), or ');
    expect(budget).toContain('state a whole number of connections, 1 or more, or leave it unset.');
    expect(budget).toContain('state ${ofTheServer.left} at most, or leave it unset.');
  });
});

describe('what a run empties', () => {
  it.each(KEPT)(
    'on %s, is every table but those the project lists, the ones of its migration tool as generated',
    (orm, kept) => {
      const root = initProject('--orm', orm, '--audit', 'on');

      expect(support(root, 'kept')).toContain(
        `export const KEPT_TABLES: readonly string[] = [\n  // What the migration tool`,
      );

      expect(support(root, 'kept')).toContain(kept);
      expect(support(root, 'kept')).toContain("  'audit.*',\n];");
      expect(support(initProject('--orm', orm, '--audit', 'off'), 'kept')).not.toContain('audit');
    },
  );

  it('is emptied in one statement without cascade, and neither a table of another role nor one of an extension', () => {
    const emptying = support(initProject(), 'emptying');

    expect(emptying).toContain("import { KEPT_TABLES } from '$test/support/test-database-kept';");

    expect(emptying).toContain(
      "return KEPT_TABLES.includes(name) || KEPT_TABLES.includes(name.replace(/\\.[^.]*$/, '.*'));",
    );

    expect(emptying).toContain('restart identity`);');
    expect(emptying).not.toContain('restart identity cascade');
    expect(emptying).not.toContain('disable trigger');
    expect(emptying).toContain("pg_has_role(c.relowner, 'USAGE') as owned");
    expect(emptying).toContain("and d.deptype = 'e')");
    expect(emptying).toContain('await copy.query(`refresh materialized view ${view.quoted}`);');
  });

  it('keeps the list of the project when init --force rewrites the support around it', () => {
    const root = initProject();
    const mine = "export const KEPT_TABLES: readonly string[] = ['public.countries'];\n";

    write(root, 'test/support/test-database-kept.ts', mine);
    write(root, 'test/support/test-database-budget.ts', '// an earlier version\n');
    commitAll(root);

    const forced = cli(root, 'init', '--force');

    expect(forced.stdout).toContain('kept         test/support/test-database-kept.ts (yours since the first init)');
    expect(support(root, 'kept')).toBe(mine);
    expect(support(root, 'budget')).toContain('export async function poolSizeFor(');
  });

  it('refuses, with both names, a kept table that references an emptied one', () => {
    expect(support(initProject(), 'emptying')).toContain(
      'The table ${broken.from} keeps its rows and references ${broken.to}, which the run empties: keep ${broken.to} too, in KEPT_TABLES of test/support/test-database-kept.ts.',
    );
  });
});

/** Drizzle and Knex close in the object they return, Prisma and TypeORM in a function above it. */
function closingIndent(orm: string): string {
  return orm === 'drizzle' || orm === 'knex' ? '\n      ' : '\n    ';
}
