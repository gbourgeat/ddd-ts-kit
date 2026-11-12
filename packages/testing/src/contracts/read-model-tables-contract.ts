import {
  InMemoryLogger,
  ReadModelTableNotReadyError,
  ReadModelTables,
  ReadModelTablesNotReadyError,
  type ReadModelTableState,
} from '@ddd-ts-kit/kernel';
import type { Awaitable } from './awaitable';
import type { ContractRunner } from './contract-runner';
import { ContractSuite } from './contract-suite';
import { failureOf } from './failure-of';
import type { ReadModelTableShape } from './read-model/read-model-table-shape';
import { READ_MODEL_TABLE_SHAPES as TABLES } from './read-model/read-model-table-shapes';
import type { ReadModelTablesUnderContract } from './read-model/read-model-tables-under-contract';

export interface ReadModelTablesContractOptions {
  readonly name: string;
  /** The read model table of the package and a way to run a statement, on a PostgreSQL database; called before each test. */
  createTables(): Awaitable<ReadModelTablesUnderContract>;
  /** True where a store names the column of its tenant: a table that keeps it under another name is then read too. */
  readonly tenantColumn?: boolean;
  /** True where the definition of a table names the columns of its stamp. */
  readonly renamedStamps?: boolean;
  /** True where a table has a definition that says which columns refuse NULL, read when the store is built. */
  readonly definition?: boolean;
}

const SCHEMA = TABLES.schema;

/** A schema of the same database that belongs to somebody else. */
const ELSEWHERE = `${SCHEMA}_elsewhere`;

const STAMP = { eventId: 'evt-1', occurredAt: new Date('2026-11-12T09:00:00.000Z') };

/** What the contract expects of a table: ready and without a constraint unless said; `unread` where the database was not asked for the constraint. */
function state(table: string, found: Partial<ReadModelTableState>, constraint?: 'unread'): ReadModelTableState {
  const read = { schema: SCHEMA, table, exists: true, refusing: [], unfit: [], row: [], deleted: 'deleted', ...found };

  return constraint === 'unread' ? read : { constraint: { state: 'missing', columns: [] }, ...read };
}

const AGENDA = state('agenda', { refusing: ['status', 'starts_at'], row: ['status', 'starts_at', 'note'] });

const CONTACTS = state('contacts', {
  refusing: ['address'],
  row: ['address', 'label'],
  constraint: { state: 'held', columns: ['label'] },
});

/** A row of the agenda as a statement writes it, beside the store. */
const agendaRow = (slug: string, values: string): string =>
  `insert into ${SCHEMA}.agenda (slug, status, starts_at, note, tenant_id, last_event_id, last_event_at, deleted) values ('${slug}', ${values}, 'acme', 'evt-0', now(), ${String(slug === 'gone')})`;

/**
 * What the read model table of every ORM package guarantees of the trace of a deleted row, on
 * PostgreSQL: what `ReadModelTables` says of the tables an application lists is, table by table,
 * what the store of each says before its first trace, the same state from the same reading, and a
 * table it finds ready takes a trace; the verdict follows the columns the store maps, whatever
 * else the table holds (a key that is not the primary key, a tenant column, a column the database
 * fills), and names what no migration opens (a part of the primary key, an identity or a
 * generated column, a table that is not there); the migration a refusal writes, run as it is and
 * run twice, makes the table ready and touches nothing the store does not map; its validation
 * scans without the lock that stops readers; a table nobody lists is never read; the start of an
 * application is refused, or told as an error.
 */
export function readModelTablesContract(runner: ContractRunner, options: ReadModelTablesContractOptions): void {
  new ReadModelTablesSuite(runner, options).describe(`${options.name} (read model tables contract)`);
}

class ReadModelTablesSuite extends ContractSuite<ReadModelTablesUnderContract> {
  /** The statements each table was migrated with, to run them a second time. */
  private readonly migrations = new Map<string, readonly string[]>();

  constructor(
    runner: ContractRunner,
    private readonly options: ReadModelTablesContractOptions,
  ) {
    super(runner, async () => {
      const subject = await options.createTables();

      for (const schema of [SCHEMA, ELSEWHERE]) {
        await subject.execute(`drop schema if exists ${schema} cascade`);
        await subject.execute(`create schema ${schema}`);
      }

      return subject;
    });
  }

  protected tests(): void {
    this.agreesWithTheStore();
    this.agreesWhereTheDefinitionSpeaks();
    this.writesTheMigration();
    this.saysWhatTheConstraintIs();
    this.readsTheListAlone();
    this.refusesOrReportsAtStart();
  }

  private agreesWithTheStore(): void {
    this.it('lets a ready table through, and its store writes the trace', async () => {
      await this.agrees(TABLES.ready, state('ready_rows', { row: ['title'], constraint: held(['title']) }));
    });

    this.it(
      'refuses, as the store does, the fields that refuse NULL and no column the store does not map',
      async () => {
        await this.agrees(TABLES.agenda, AGENDA);
        await this.agrees(TABLES.contacts, CONTACTS);
      },
    );

    this.it('refuses, as the store does, the tenant column a store of every tenant maps as a field', async () => {
      await this.agrees(
        TABLES.untenanted,
        state('untenanted_rows', { refusing: ['tenant_id'], row: ['tenant_id', 'title'] }),
      );
    });

    this.it(
      'refuses, as the store does, a part of the primary key mapped as a field, which no migration opens',
      async () => {
        const found = state('composite_rows', {
          unfit: [{ column: 'region', because: 'primary-key' }],
          row: ['title'],
        });
        const refusal = await this.agrees(TABLES.composite, found);

        this.expect(refusal?.statements).toEqual([]);
        this.expect(refusal?.message.includes('"region" is part of the primary key')).toBe(true);
      },
    );

    this.it('refuses, as the store does, an identity and a generated column mapped as fields', async () => {
      const unfit = [
        { column: 'serial', because: 'identity' },
        { column: 'label_upper', because: 'generated' },
      ] as const;

      const refusal = await this.agrees(TABLES.computed, state('computed_rows', { unfit, row: ['label'] }));

      this.expect(refusal?.statements).toEqual([]);
    });

    this.it('refuses, as the store does, a table that is not in the database', async () => {
      const refusal = await this.agrees(TABLES.absent, state('absent_rows', { exists: false }, 'unread'));

      this.expect(refusal?.message.includes('it is not in this database')).toBe(true);
    });
  }

  private agreesWhereTheDefinitionSpeaks(): void {
    if (this.options.tenantColumn === true) {
      this.it('leaves the tenant out under the name the store gives its column', async () => {
        await this.agrees(TABLES.network, state('network_rows', { refusing: ['status'], row: ['status'] }));
        await this.migrate(TABLES.network);

        this.expect(await this.refusingNull('network_rows')).toEqual([
          'deleted',
          'id',
          'last_event_at',
          'last_event_id',
          'network',
        ]);
      });
    } else {
      this.todo('leaves the tenant out under the name the store gives its column (the store names no column)');
    }

    if (this.options.renamedStamps === true) {
      this.it('writes the migration with the columns of the stamp as the definition names them', async () => {
        const found = state('renamed_rows', { refusing: ['title'], row: ['title'], deleted: 'removed' });
        const refusal = await this.agrees(TABLES.renamed, found);

        this.expect(refusal?.statements.some((statement) => statement.includes('check ("removed" or ('))).toBe(true);

        await this.migrate(TABLES.renamed);

        this.expect(await this.traced(TABLES.renamed.shape)).toBe(undefined);
      });
    } else {
      this.todo('writes the migration with the columns of the stamp as the definition names them (fixed names)');
    }

    if (this.options.definition === true) {
      this.it(
        'reports a definition that refuses NULL over a table that is ready, as the store refuses to be built',
        async () => {
          const found = state('strict_definition_rows', { refusing: ['title'], row: ['title'] }, 'unread');
          const refusal = await this.agrees(TABLES.strict, found);

          this.expect(refusal?.statements).toEqual([]);
          this.expect(refusal?.message.includes('The definition the store reads says so')).toBe(true);
        },
      );
    } else {
      this.todo('reports a definition that refuses NULL over a table that is ready (no definition)');
    }
  }

  private writesTheMigration(): void {
    this.it(
      'makes the table ready by the migration it writes, run as it is and twice, nothing else touched',
      async () => {
        await this.create(TABLES.agenda);
        await this.subject.execute(agendaRow('gone', "'booked', '09:00', 'a note'"));
        await this.subject.execute(agendaRow('kept', "'booked', '10:00', null"));
        await this.migrate(TABLES.agenda);
        await this.migrate(TABLES.agenda, 'again');

        const rows = await this.subject.execute(
          `select slug, status, starts_at, note, tenant_id, owner, created_at is not null as created, id is not null as numbered from ${SCHEMA}.agenda order by slug`,
        );

        this.expect(rows.map((row) => ({ ...row }))).toEqual([
          {
            slug: 'gone',
            status: null,
            starts_at: null,
            note: null,
            tenant_id: 'acme',
            owner: 'nobody',
            created: true,
            numbered: true,
          },
          {
            slug: 'kept',
            status: 'booked',
            starts_at: '10:00',
            note: null,
            tenant_id: 'acme',
            owner: 'nobody',
            created: true,
            numbered: true,
          },
        ]);

        this.expect(await this.refusingNull('agenda')).toEqual([
          'created_at',
          'deleted',
          'id',
          'last_event_at',
          'last_event_id',
          'owner',
          'slug',
          'tenant_id',
        ]);

        await this.agrees(
          TABLES.agenda,
          { ...AGENDA, refusing: [], constraint: held(['status', 'starts_at']) },
          'created',
        );
        this.expect(
          (await failureOf(() => this.subject.execute(agendaRow('live', "null, '11:00', null")))) === undefined,
        ).toBe(false);
      },
    );

    this.it('writes again a constraint that holds other fields, with the ones that lose NOT NULL', async () => {
      await this.create(TABLES.contacts);
      await this.migrate(TABLES.contacts);
      await this.agrees(
        TABLES.contacts,
        { ...CONTACTS, refusing: [], constraint: held(['label', 'address']) },
        'created',
      );
    });

    this.it('validates the constraint without the lock that stops the readers of the table', async () => {
      await this.create(TABLES.agenda);

      const statements = await this.statementsOf(TABLES.agenda.shape);
      const validation = statements.findIndex((statement) => statement.includes(' validate constraint '));

      for (const statement of statements.slice(0, validation)) {
        await this.subject.execute(statement);
      }

      const locks = await this.subject.transaction(async () => {
        await this.subject.execute(statements[validation] ?? '');

        return this.subject.execute(
          `select mode from pg_locks where relation = to_regclass('${SCHEMA}.agenda') and pid = pg_backend_pid()`,
        );
      });

      const modes = locks.map((lock) => String(lock['mode']));

      this.expect(modes.includes('ShareUpdateExclusiveLock')).toBe(true);
      this.expect(modes.includes('AccessExclusiveLock')).toBe(false);
    });
  }

  private saysWhatTheConstraintIs(): void {
    const name = 'noted_rows_live_rows_whole';
    const constrained = `alter table ${SCHEMA}.noted_rows add constraint ${name} check`;

    this.it('says, as a warning, that a constraint is not validated, and writes how to validate it', async () => {
      await this.create(TABLES.noted);
      await this.subject.execute(`${constrained} (deleted or (title is not null)) not valid`);

      const logger = new InMemoryLogger();
      const found = state('noted_rows', { row: ['title'], constraint: { state: 'not-valid', columns: ['title'] } });

      await this.agrees(TABLES.noted, found, 'created');
      await this.listed(TABLES.noted.shape).atStart(logger);

      this.expect(logger.entries.map(({ level }) => level)).toEqual(['warn']);

      await this.subject.execute(/Run: (.+)$/.exec(logger.entries[0]?.message ?? '')?.[1] ?? '');
      await this.agrees(TABLES.noted, { ...found, constraint: held(['title']) }, 'created');
    });

    this.it('says, as a warning, that a constraint of that name checks something else, and leaves it', async () => {
      await this.create(TABLES.noted);
      await this.subject.execute(`${constrained} (title <> 'none')`);

      const logger = new InMemoryLogger();
      const [found] = await this.listed(TABLES.noted.shape).states();

      await this.listed(TABLES.noted.shape).atStart(logger);

      this.expect(found?.constraint?.state).toBe('unexpected');
      this.expect(logger.entries.map(({ level }) => level)).toEqual(['warn']);
      this.expect(await this.traced(TABLES.noted.shape)).toBe(undefined);
    });
  }

  private readsTheListAlone(): void {
    this.it(
      'never reads a table nobody lists: one of another schema that carries the stamp changes nothing',
      async () => {
        await this.create(TABLES.ready);
        await this.subject.execute(TABLES.agenda.created.replace(`${SCHEMA}.`, `${ELSEWHERE}.`));

        const logger = new InMemoryLogger();

        await this.listed(TABLES.ready.shape).atStart(logger);
        await this.listed().atStart(logger);

        this.expect(logger.entries).toEqual([]);
        this.expect(await this.listed().states()).toEqual([]);
      },
    );
  }

  private refusesOrReportsAtStart(): void {
    const all = [TABLES.ready, TABLES.agenda, TABLES.contacts] as const;

    this.it('refuses the start of an application with one error that names every listed table not ready', async () => {
      await this.create(...all);

      const logger = new InMemoryLogger();
      const refusal = await failureOf(() => this.listed(...all.map(({ shape }) => shape)).atStart(logger));

      this.expect(
        refusal instanceof ReadModelTablesNotReadyError ? refusal.tables.map(({ state: found }) => found) : [],
      ).toEqual([AGENDA, CONTACTS]);

      this.expect(logger.entries).toEqual([]);
    });

    this.it('reports the same as one error and lets the start go on, when the application says so', async () => {
      await this.create(...all);

      const logger = new InMemoryLogger();

      await this.listed(...all.map(({ shape }) => shape)).atStart(logger, 'reported');

      this.expect(logger.entries.map(({ level, fields }) => [level, fields['tables']])).toEqual([
        ['error', `${SCHEMA}.agenda, ${SCHEMA}.contacts`],
      ]);
    });
  }

  private listed(...shapes: readonly ReadModelTableShape[]): ReadModelTables {
    return new ReadModelTables(shapes.map((shape) => () => this.subject.table(shape)));
  }

  /** What the store answers to the trace of a deleted row under a key it does not hold: nothing when it wrote it. */
  private traced(shape: ReadModelTableShape): Promise<unknown> {
    return failureOf(() =>
      this.subject.table(shape).insert({ key: `trace-of-${shape.table}`, row: undefined, stamp: STAMP }),
    );
  }

  /**
   * The list and the store say the same of the table: this state, read by both, and a refusal
   * of the store exactly when the list finds the table not ready. Answers that refusal.
   */
  private async agrees(
    table: (typeof TABLES)['ready'],
    expected: ReadModelTableState,
    existing?: 'created',
  ): Promise<ReadModelTableNotReadyError | undefined> {
    if (existing === undefined) {
      await this.create(table);
    }

    const tables = this.listed(table.shape);
    const refusal = await this.traced(table.shape);
    const refused = refusal instanceof ReadModelTableNotReadyError ? refusal : undefined;

    this.expect(await tables.states()).toEqual([expected]);
    this.expect((await tables.notReady()).length === 1).toBe(refused !== undefined);
    this.expect(refused === undefined ? refusal : refused.state).toEqual(refused === undefined ? undefined : expected);

    return refused;
  }

  private async create(...tables: readonly { readonly created: string }[]): Promise<void> {
    for (const { created } of tables) {
      if (!created.endsWith('()')) {
        await this.subject.execute(created);
      }
    }
  }

  private async statementsOf(shape: ReadModelTableShape): Promise<readonly string[]> {
    const refusal = await this.traced(shape);

    return refusal instanceof ReadModelTableNotReadyError ? refusal.statements : [];
  }

  /** Runs the migration the store writes for the table, each statement as it is; `again` runs the same statements a second time. */
  private async migrate({ shape }: { readonly shape: ReadModelTableShape }, again?: 'again'): Promise<void> {
    this.migrations.set(
      shape.table,
      again === undefined ? await this.statementsOf(shape) : (this.migrations.get(shape.table) ?? []),
    );

    for (const statement of this.migrations.get(shape.table) ?? []) {
      await this.subject.execute(statement);
    }
  }

  /** The columns of a table that refuse NULL, read in the catalog. */
  private async refusingNull(table: string): Promise<string[]> {
    const columns = await this.subject.execute(
      `select attname as "column" from pg_attribute where attrelid = to_regclass('${SCHEMA}.${table}') and attnotnull and attnum > 0 and not attisdropped order by attname`,
    );

    return columns.map((column) => String(column['column']));
  }
}

function held(columns: readonly string[]): NonNullable<ReadModelTableState['constraint']> {
  return { state: 'held', columns };
}
