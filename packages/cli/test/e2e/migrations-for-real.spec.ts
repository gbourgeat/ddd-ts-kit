import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { cli, read, removeTempDir, tempDir, write } from '../helpers';
import { copiesLike, runEndToEndTwiceAtOnce } from './end-to-end-on-copies';
import { installForReal } from './install-for-real';
import { runIn } from './run-in';
import { SLOW } from './stacks';

/** A PostgreSQL server whose user may create databases, `postgres://app:app@localhost:5432`: the pipeline starts one. */
const SERVER = process.env['DDD_TS_KIT_MIGRATIONS_SERVER'];

/** The triggers that keep the audit trail append-only, as `@ddd-ts-kit/audit` names them. */
const GUARD = [
  'audit_archives_no_rewrite',
  'audit_archives_no_truncate',
  'audit_entries_no_rewrite',
  'audit_entries_no_truncate',
];

/**
 * The ORM, the test runner, and how the second table reaches a migration on each ORM, as
 * `db:generate` takes its name and the guides write it. Jest runs once: what differs under it is the
 * global setup and the configuration of the end-to-end run, the same on the four ORM.
 */
const TOOLS = [
  ['drizzle', 'vitest', 'npm run db:generate add-invoices'],
  ['knex', 'vitest', 'npm run db:generate add-invoices'],
  ['prisma', 'vitest', 'npm run db:generate add-invoices'],
  ['typeorm', 'vitest', 'npm run build && npm run db:generate migrations/add-invoices'],
  ['knex', 'jest', 'npm run db:generate add-invoices'],
] as const;

const ORDER_TERM = 'Order=A purchase';
const INVOICE_TERM = 'Invoice=A bill';
const SHIPPED_ORDER_TERM = 'Order=What a carrier is asked to deliver';

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1 and DDD_TS_KIT_MIGRATIONS_SERVER): a project with an audit trail,
 * installed for real, runs the database lines of its README as written from an empty real
 * PostgreSQL, `DATABASE_URL` in `.env` and nowhere else; its end-to-end specs, started twice at the
 * same time on that server while the migrated database holds 80 MB of rows, each run their files on
 * copies of its tables, empty, at the same time, and leave none behind, and a run the server has no
 * connection for is refused with its numbers; a second table, and one of the name of the first in a
 * second context, reach the same database by `db:generate` and `db:migrate`; a fresh database built from the migrations alone then holds
 * the same columns, the audit trail append-only on both, and every gate stays green.
 */
describe.runIf(SLOW && SERVER !== undefined)('the migrations of a generated project, on a real PostgreSQL', () => {
  it.each(TOOLS)(
    'on %s under %s, the README builds the tables, two end-to-end runs share the server, a second table and one of the same name in a second context arrive, a fresh database replays them all',
    async (orm, tests, generateInvoices) => {
      const existing = `migrations_${orm}_${tests}`;
      const fresh = `migrations_${orm}_${tests}_fresh`;
      const root = tempDir(`migrations-${orm}-${tests}`);

      const sh = (command: string): string =>
        runIn(root, { command: 'sh', args: ['-c', `unset DATABASE_URL; ${command} 2>&1`] });

      await renewed(existing);
      await renewed(fresh);

      const stack = ['--orm', orm, '--tests', tests, '--audit', 'on'];
      const contexts = ['--context', 'ordering:core', '--context', 'shipping:supporting'];
      const init = ['init', ...stack, ...contexts, '--package-manager', 'npm'];

      expect(cli(root, ...init).code).toBe(0);
      expect(cli(root, 'generate', 'aggregate', 'ordering', 'Order', '--term', ORDER_TERM).code).toBe(0);
      expect(cli(root, 'generate', 'repository', 'ordering', 'Order').code).toBe(0);
      installForReal(root, 'npm');
      pointEnvAt(root, existing);

      const lines = databaseLinesOfReadme(root);

      expect(lines.some((line) => line.includes('db:migrate'))).toBe(true);

      for (const line of lines) {
        sh(line);
      }

      expect(await columnsOf(existing)).toContain('ordering.orders.id');
      expect(await triggersOf(existing)).toEqual(GUARD);

      const endToEnd = await runEndToEndTwiceAtOnce(root, SERVER ?? '', existing, tests);

      expect(endToEnd.passed, endToEnd.printed).toBe(2);
      expect(endToEnd.together).toBeGreaterThanOrEqual(2);

      expect(endToEnd.refused).toMatch(
        /\d+ spec files at once need \d+ connections \(2 for each application at least and 1 to spare\), and TEST_DATABASE_CONNECTIONS allows 1: state more in TEST_DATABASE_CONNECTIONS/,
      );

      // The run counts its three spec files, not the workers it could start.
      expect(endToEnd.unfit).toBe('');
      expect(await copiesOf(existing)).toEqual([]);

      expect(cli(root, 'generate', 'aggregate', 'ordering', 'Invoice', '--term', INVOICE_TERM).code).toBe(0);
      expect(cli(root, 'generate', 'repository', 'ordering', 'Invoice').code).toBe(0);
      // A table of the name of one of ordering, in the schema of a second context: the migration holds both.
      expect(cli(root, 'generate', 'aggregate', 'shipping', 'Order', '--term', SHIPPED_ORDER_TERM).code).toBe(0);
      expect(cli(root, 'generate', 'repository', 'shipping', 'Order').code).toBe(0);
      exportUnderASecondName(root, orm);
      sh(generateInvoices);
      sh('npm run db:migrate');

      if (orm === 'drizzle') {
        // One table the index exports under two names is one table to drizzle-kit: created once, no word about it.
        expect(migrationsOf(root).split('CREATE TABLE "shipping"."orders"')).toHaveLength(2);
      }

      const columns = await columnsOf(existing);

      expect(columns).toContain('ordering.invoices.id');
      expect(columns).toContain('shipping.orders.id');

      pointEnvAt(root, fresh);
      sh('npm run db:migrate');

      expect(await columnsOf(fresh)).toEqual(columns);
      expect(await triggersOf(fresh)).toEqual(GUARD);
      // Each gate fails the shell, and so the spec, on a finding.
      sh('npm run typecheck && npm run lint && npm run format:check && npm run check:arch && npm run deadcode');
      // An installed project is several hundred megabytes: five of them are not kept until the file ends.
      removeTempDir(root);
    },
    1_200_000,
  );
});

/**
 * On Drizzle, the table of shipping exported by the index under a second name, as a merge of two
 * branches that each settled the name its own way leaves one table under two names.
 */
function exportUnderASecondName(root: string, orm: string): void {
  if (orm === 'drizzle') {
    const index = 'src/platform/database/schema.ts';

    const settled =
      "export { orders as shippingOrders } from '@/contexts/shipping/infrastructure/persistence/shipping.schema';";

    expect(read(root, index)).toContain(settled);

    write(
      root,
      index,
      read(root, index).replace(settled, `${settled}\n${settled.replace('shippingOrders', 'carriedOrders')}`),
    );
  }
}

/** Every migration of the project, as one text. */
function migrationsOf(root: string): string {
  return fs
    .readdirSync(path.join(root, 'migrations'), { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.sql'))
    .map((file) => read(root, `migrations/${file}`))
    .join('\n');
}

/** The lines of "Run it" that reach the database, as the README writes them, their comments left out. */
function databaseLinesOfReadme(root: string): string[] {
  const block = /## Run it\n\n```bash\n([^]*?)```/.exec(read(root, 'README.md'))?.[1] ?? '';

  return block
    .split('\n')
    .filter((line) => line.includes('db:'))
    .map((line) => line.replace(/\s+#.*$/, ''));
}

/** `cp .env.example .env`, as the README says, with the address of the database the run is given. */
function pointEnvAt(root: string, database: string): void {
  const url = `DATABASE_URL=${SERVER ?? ''}/${database}`;

  write(root, '.env', read(root, '.env.example').replace(/^DATABASE_URL=.*$/m, url));
}

async function renewed(database: string): Promise<void> {
  const client = new pg.Client({ connectionString: `${SERVER ?? ''}/postgres` });

  await client.connect();
  await client.query(`drop database if exists ${database} with (force)`);
  await client.query(`create database ${database}`);
  await client.end();
}

/** The copies of `database` the end-to-end runs made and did not drop. */
async function copiesOf(database: string): Promise<string[]> {
  const rows = await rowsOf<{ datname: string }>(
    'postgres',
    `select datname from pg_database where datname like '${copiesLike(database)}'`,
  );

  return rows.map((row) => row.datname);
}

async function triggersOf(database: string): Promise<string[]> {
  const rows = await rowsOf<{ tgname: string }>(
    database,
    "select tgname from pg_trigger where tgname like 'audit_%' order by tgname",
  );

  return rows.map((row) => row.tgname);
}

/** Every column of the application, by schema and table: what two databases are compared on. */
async function columnsOf(database: string): Promise<string[]> {
  const rows = await rowsOf<{ name: string }>(
    database,
    `select table_schema || '.' || table_name || '.' || column_name as name
     from information_schema.columns
     where table_schema not in ('pg_catalog', 'information_schema')
     order by 1`,
  );

  return rows.map((row) => row.name);
}

async function rowsOf<Row extends pg.QueryResultRow>(database: string, sql: string): Promise<Row[]> {
  const client = new pg.Client({ connectionString: `${SERVER ?? ''}/${database}` });

  await client.connect();

  const { rows } = await client.query<Row>(sql);

  await client.end();

  return rows;
}
