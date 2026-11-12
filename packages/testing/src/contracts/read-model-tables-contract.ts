import {
  InMemoryLogger,
  ReadModelTablesNotReadyError,
  type ReadModelTablesOptions,
  type UnreadyReadModelTable,
} from '@ddd-ts-kit/kernel';
import type { Awaitable } from './awaitable';
import type { ContractRunner } from './contract-runner';
import { ContractSuite } from './contract-suite';
import { failureOf } from './failure-of';
import type { ReadModelTablesUnderContract } from './read-model/read-model-tables-under-contract';

export interface ReadModelTablesContractOptions {
  readonly name: string;
  /** The check of the package and a way to run a statement, on a PostgreSQL database; called before each test. */
  createTables(): Awaitable<ReadModelTablesUnderContract>;
}

/** The schema the contract creates its tables in, and drops before each test: what it asserts is read there alone. */
const SCHEMA = 'tables_contract';

const STAMP =
  'last_event_id text not null, last_event_at timestamptz not null, last_event_version bigint, deleted boolean not null default false';

/** A read model as the kit writes it since a deleted row keeps no data: its row accepts NULL, a constraint keeps the live rows whole. */
const READY = `create table ${SCHEMA}.ready_rows (id text primary key, title text, tenant_id text not null, ${STAMP}, constraint ready_rows_live_rows_whole check (deleted or (title is not null)))`;

/** No read model: it has no stamp, and what its columns refuse is its own business. */
const ORDERS = `create table ${SCHEMA}.orders (id text primary key, total integer not null, deleted boolean not null default false)`;

/** A read model declared before: two columns of the row refuse NULL, a third one is filled by the database, and nothing keeps the live rows whole. */
const AGENDA = `create table ${SCHEMA}.agenda (region text not null, id text not null, status text not null, starts_at timestamptz not null, note text, created_at timestamptz not null default now(), tenant_id text not null, ${STAMP}, primary key (region, id))`;

/** A read model whose migration stopped half-way: the constraint is there, a column still refuses NULL. */
const CONTACTS = `create table ${SCHEMA}.contacts (id text primary key, address text not null, label text, ${STAMP}, constraint contacts_live_rows_whole check (deleted or (label is not null)))`;

const UNREADY_AGENDA: UnreadyReadModelTable = {
  schema: SCHEMA,
  table: 'agenda',
  refusing: ['status', 'starts_at', 'created_at'],
  row: ['status', 'starts_at', 'note', 'created_at'],
  constraint: false,
};

const UNREADY_CONTACTS: UnreadyReadModelTable = {
  schema: SCHEMA,
  table: 'contacts',
  refusing: ['address'],
  row: ['address', 'label'],
  constraint: true,
};

/** The column of the agenda the database fills and no store writes. */
const FILLED_BY_THE_DATABASE: ReadModelTablesOptions = { kept: [`${SCHEMA}.agenda.created_at`] };

/**
 * What the check of the read model tables of every ORM package guarantees, on PostgreSQL: every
 * table that cannot hold the trace of a deleted row is named in one pass, with the columns that
 * refuse NULL and whether its check constraint is missing, whatever stores exist; the key, the
 * tenant, the stamp and the columns the options name are left out, and so are a table without a
 * stamp and the copy of a rebuild; the migration each refusal writes makes its table ready; the
 * start of an application is refused, or told as an error. The database may hold other read model
 * tables: the contract asserts what is said of its own schema.
 */
export function readModelTablesContract(runner: ContractRunner, options: ReadModelTablesContractOptions): void {
  new ReadModelTablesSuite(runner, options).describe(`${options.name} (read model tables contract)`);
}

class ReadModelTablesSuite extends ContractSuite<ReadModelTablesUnderContract> {
  constructor(runner: ContractRunner, options: ReadModelTablesContractOptions) {
    super(runner, async () => {
      const subject = await options.createTables();

      await subject.execute(`drop schema if exists ${SCHEMA} cascade`);
      await subject.execute(`create schema ${SCHEMA}`);

      return subject;
    });
  }

  protected tests(): void {
    this.letsReadyTablesThrough();
    this.namesEveryTable();
    this.leavesOutWhatIsKept();
    this.writesTheMigration();
    this.refusesOrReportsAtStart();
  }

  private letsReadyTablesThrough(): void {
    this.it('finds nothing to refuse in ready tables, nor in a table that is no read model', async () => {
      await this.create(READY, ORDERS);

      this.expect(await this.unready()).toEqual([]);
    });
  }

  private namesEveryTable(): void {
    this.it('names every table that is not ready, each with its columns and its constraint', async () => {
      await this.create(READY, AGENDA, CONTACTS);

      this.expect(await this.unready()).toEqual([UNREADY_AGENDA, UNREADY_CONTACTS]);
    });

    this.it('names a table once while a rebuild holds its copy', async () => {
      await this.create(AGENDA, `create table ${SCHEMA}.agenda__rebuild (like ${SCHEMA}.agenda including all)`);

      this.expect(await this.unready()).toEqual([UNREADY_AGENDA]);
    });
  }

  private leavesOutWhatIsKept(): void {
    this.it('leaves out the key, the tenant, the stamp and the columns the options name', async () => {
      await this.create(AGENDA);

      this.expect(await this.unready(FILLED_BY_THE_DATABASE)).toEqual([
        { ...UNREADY_AGENDA, refusing: ['status', 'starts_at'], row: ['status', 'starts_at', 'note'] },
      ]);
    });
  }

  private writesTheMigration(): void {
    this.it('writes for each table the migration that makes it ready, and keeps its live rows whole', async () => {
      await this.create(AGENDA);

      const refusal = await failureOf(() => this.subject.tables(FILLED_BY_THE_DATABASE).require());
      const refused = refusal instanceof ReadModelTablesNotReadyError ? refusal.tables : [];
      const migrations = refused.filter(({ unready }) => unready.schema === SCHEMA).map(({ migration }) => migration);

      this.expect(migrations.length).toBe(1);

      for (const statement of statementsOf(migrations.join('\n'))) {
        await this.subject.execute(statement);
      }

      const stamped = `'acme', 'evt-1', now()`;
      const columns = 'region, id, status, starts_at, tenant_id, last_event_id, last_event_at';
      const live = `insert into ${SCHEMA}.agenda (${columns}) values ('eu', 'a1', null, now(), ${stamped})`;
      const trace = `insert into ${SCHEMA}.agenda (${columns}, deleted) values ('eu', 'a2', null, null, ${stamped}, true)`;

      this.expect(await this.unready(FILLED_BY_THE_DATABASE)).toEqual([]);
      this.expect((await failureOf(() => this.subject.execute(live))) === undefined).toBe(false);
      this.expect(await failureOf(() => this.subject.execute(trace))).toBe(undefined);
    });
  }

  private refusesOrReportsAtStart(): void {
    this.it('refuses the start of an application with one error that names every table', async () => {
      await this.create(AGENDA, CONTACTS);

      const logger = new InMemoryLogger();
      const refusal = await failureOf(() => this.subject.tables().atStart(logger));
      const refused = refusal instanceof ReadModelTablesNotReadyError ? refusal.tables.map(({ table }) => table) : [];

      this.expect(refused.filter((table) => table.startsWith(`${SCHEMA}.`))).toEqual([
        `${SCHEMA}.agenda`,
        `${SCHEMA}.contacts`,
      ]);

      this.expect(logger.entries).toEqual([]);
    });

    this.it('reports the same as one error and lets the start go on, when the application says so', async () => {
      await this.create(AGENDA, CONTACTS);

      const logger = new InMemoryLogger();

      await this.subject.tables().atStart(logger, 'reported');

      const [entry] = logger.entries;
      const tables = entry?.fields['tables'];
      const named = typeof tables === 'string' ? tables : '';

      this.expect(logger.entries.length).toBe(1);
      this.expect(entry?.level).toBe('error');
      this.expect(named.includes(`${SCHEMA}.agenda`) && named.includes(`${SCHEMA}.contacts`)).toBe(true);
      this.expect(entry?.message.includes(`alter table ${SCHEMA}.contacts`)).toBe(true);
    });
  }

  private async create(...statements: readonly string[]): Promise<void> {
    for (const statement of statements) {
      await this.subject.execute(statement);
    }
  }

  /** What the check says of the tables of the contract: the database of a package may hold others. */
  private async unready(options?: ReadModelTablesOptions): Promise<readonly UnreadyReadModelTable[]> {
    const tables = await this.subject.tables(options).notReady();

    return tables.filter((table) => table.schema === SCHEMA);
  }
}

/** The statements of a migration, one at a time and without its comments: a driver that prepares its statements takes one. */
function statementsOf(migration: string): string[] {
  const written = migration.split('\n').filter((line) => !line.startsWith('--'));

  return written
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '');
}
