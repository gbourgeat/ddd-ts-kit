import { InMemoryLogger } from '@ddd-ts-kit/kernel';
import { failureOf } from '../failure-of';
import { READ_MODEL_TABLE_SHAPES as TABLES } from './read-model-table-shapes';
import { ReadModelTablesSuite } from './read-model-tables-suite';

/** What the migration leaves of the two rows written beside the store: the deleted one emptied of its fields, nothing else touched. */
const MIGRATED = [
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
];

/**
 * The migration a refusal writes, run as it is and run twice, makes the table ready and touches
 * nothing the store does not map; its validation scans without the lock that stops readers; and a
 * constraint that is not validated, or that checks something else, is told as a warning.
 */
export class TableMigrationSuite extends ReadModelTablesSuite {
  protected tests(): void {
    this.makesTheTableReady();
    this.writesTheConstraintAgain();
    this.validatesWithoutStoppingReaders();
    this.saysWhatTheConstraintIs();
  }

  private makesTheTableReady(): void {
    this.it(
      'makes the table ready by the migration it writes, run as it is and twice, nothing else touched',
      async () => {
        await this.create(TABLES.agenda);
        await this.subject.execute(this.agendaRow('gone', "'booked', '09:00', 'a note'"));
        await this.subject.execute(this.agendaRow('kept', "'booked', '10:00', null"));
        await this.run(await this.migrate(TABLES.agenda));

        const rows = await this.subject.execute(
          `select slug, status, starts_at, note, tenant_id, owner, created_at is not null as created, id is not null as numbered from ${this.schema}.agenda order by slug`,
        );

        this.expect(rows.map((row) => ({ ...row }))).toEqual(MIGRATED);

        this.expect((await this.refusingNull('agenda')).join(' ')).toBe(
          'created_at deleted id last_event_at last_event_id owner slug tenant_id',
        );

        const held = { state: 'held', columns: ['status', 'starts_at'] } as const;

        await this.agrees(TABLES.agenda, { ...this.agenda, refusing: [], constraint: held }, 'created');

        const live = await failureOf(() => this.subject.execute(this.agendaRow('live', "null, '11:00', null")));

        this.expect(live === undefined).toBe(false);
      },
    );
  }

  private writesTheConstraintAgain(): void {
    this.it('writes again a constraint that holds other fields, with the ones that lose NOT NULL', async () => {
      await this.create(TABLES.contacts);
      await this.migrate(TABLES.contacts);

      const held = { state: 'held', columns: ['label', 'address'] } as const;

      await this.agrees(TABLES.contacts, { ...this.contacts, refusing: [], constraint: held }, 'created');
    });
  }

  private validatesWithoutStoppingReaders(): void {
    this.it('validates the constraint without the lock that stops the readers of the table', async () => {
      await this.create(TABLES.agenda);

      const statements = await this.statementsOf(TABLES.agenda.shape);
      const validation = statements.findIndex((statement) => statement.includes(' validate constraint '));

      await this.run(statements.slice(0, validation));

      const locks = await this.subject.transaction(async () => {
        await this.run(statements.slice(validation, validation + 1));

        return this.subject.execute(
          `select mode from pg_locks where relation = to_regclass('${this.schema}.agenda') and pid = pg_backend_pid()`,
        );
      });

      const modes = locks.map((lock) => String(lock['mode']));

      this.expect(modes.includes('ShareUpdateExclusiveLock')).toBe(true);
      this.expect(modes.includes('AccessExclusiveLock')).toBe(false);
    });
  }

  private saysWhatTheConstraintIs(): void {
    const constrained = `alter table ${this.schema}.noted_rows add constraint noted_rows_live_rows_whole check`;

    this.it('says, as a warning, that a constraint is not validated, and writes how to validate it', async () => {
      await this.create(TABLES.noted);
      await this.subject.execute(`${constrained} (deleted or (title is not null)) not valid`);

      const logger = new InMemoryLogger();

      const found = this.expected('noted_rows', {
        row: ['title'],
        constraint: { state: 'not-valid', columns: ['title'] },
      });

      await this.agrees(TABLES.noted, found, 'created');
      await this.listed(TABLES.noted.shape).atStart(logger);

      this.expect(logger.entries.map(({ level }) => level)).toEqual(['warn']);

      await this.run(logger.entries.flatMap(({ message }) => message.split('Run: ').slice(1)));
      await this.agrees(TABLES.noted, { ...found, constraint: { state: 'held', columns: ['title'] } }, 'created');
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

  /** A row of the agenda as a statement writes it, beside the store. */
  private agendaRow(slug: string, values: string): string {
    return `insert into ${this.schema}.agenda (slug, status, starts_at, note, tenant_id, last_event_id, last_event_at, deleted) values ('${slug}', ${values}, 'acme', 'evt-0', now(), ${String(slug === 'gone')})`;
  }
}
