import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from '../helpers';
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

/** The ORM, and how the second table reaches a migration on each, as `db:generate` takes its name and the guides write it. */
const TOOLS = [
  ['drizzle', 'npm run db:generate add-invoices'],
  ['knex', 'npm run db:generate add-invoices'],
  ['prisma', 'npm run db:generate add-invoices'],
  ['typeorm', 'npm run build && npm run db:generate migrations/add-invoices'],
] as const;

const ORDER_TERM = 'Order=A purchase';
const INVOICE_TERM = 'Invoice=A bill';

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1 and DDD_TS_KIT_MIGRATIONS_SERVER): a project with an audit trail,
 * installed for real, runs the database lines of its README as written from an empty real
 * PostgreSQL, `DATABASE_URL` in `.env` and nowhere else; a second table reaches the same database
 * by `db:generate` and `db:migrate`; a fresh database built from the migrations alone then holds
 * the same columns, the audit trail append-only on both, and every gate stays green.
 */
describe.runIf(SLOW && SERVER !== undefined)('the migrations of a generated project, on a real PostgreSQL', () => {
  it.each(TOOLS)(
    'on %s, the README builds the tables, a second table arrives, a fresh database replays them all',
    async (orm, generateInvoices) => {
      const existing = `migrations_${orm}`;
      const fresh = `migrations_${orm}_fresh`;
      const root = tempDir(`migrations-${orm}`);

      const sh = (command: string): string =>
        runIn(root, { command: 'sh', args: ['-c', `unset DATABASE_URL; ${command} 2>&1`] });

      await renewed(existing);
      await renewed(fresh);

      const init = ['init', '--orm', orm, '--audit', 'on', '--context', 'ordering:core', '--package-manager', 'npm'];

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

      expect(cli(root, 'generate', 'aggregate', 'ordering', 'Invoice', '--term', INVOICE_TERM).code).toBe(0);
      expect(cli(root, 'generate', 'repository', 'ordering', 'Invoice').code).toBe(0);
      sh(generateInvoices);
      sh('npm run db:migrate');

      const columns = await columnsOf(existing);

      expect(columns).toContain('ordering.invoices.id');

      pointEnvAt(root, fresh);
      sh('npm run db:migrate');

      expect(await columnsOf(fresh)).toEqual(columns);
      expect(await triggersOf(fresh)).toEqual(GUARD);
      // Each gate fails the shell, and so the spec, on a finding.
      sh('npm run typecheck && npm run lint && npm run format:check && npm run check:arch && npm run deadcode');
    },
    1_200_000,
  );
});

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
