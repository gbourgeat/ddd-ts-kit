import { InMemoryLogger, ReadModelTables, ReadModelTablesNotReadyError } from '@ddd-ts-kit/kernel';
import { failureOf } from '../failure-of';
import { READ_MODEL_TABLE_SHAPES as TABLES } from './read-model-table-shapes';
import { ReadModelTablesSuite } from './read-model-tables-suite';

/** Checks under the name of the kit's constraint that only look like it: each lets a live row be emptied, or refuses a trace. */
const LOOK_ALIKES = [
  "(deleted or title is not null) and last_event_id <> ''",
  'deleted or not (title is not null)',
  'deleted or (title is not null) or (last_event_id is null)',
  'deleted or (title is null)',
];

/**
 * What the check does not decide is said, never passed over: a constraint under the kit's name
 * that is not written as the kit writes it is read as another check and never dropped, another
 * check constraint on a field of the row and a view are warnings, and a table that cannot be
 * read is told under its name while the others are still read.
 */
export class TableDoubtsSuite extends ReadModelTablesSuite {
  protected tests(): void {
    this.readsTheKitFormAlone();
    this.neverDropsAnotherConstraint();
    this.warnsOfWhatItDoesNotRead();
    this.triesEveryEntry();
  }

  private readsTheKitFormAlone(): void {
    this.it(
      'reads as another check a constraint of that name that only looks like the one the kit writes',
      async () => {
        for (const check of LOOK_ALIKES) {
          await this.subject.execute(`drop table if exists ${this.schema}.noted_rows`);
          await this.create(TABLES.noted);
          await this.constrain('noted_rows', check);

          const [found] = await this.listed(TABLES.noted.shape).states();

          this.expect([check, found?.constraint?.state, found?.constraint?.columns]).toEqual([check, 'unexpected', []]);
        }
      },
    );
  }

  private neverDropsAnotherConstraint(): void {
    this.it(
      "fails, and changes nothing, on a database where the constraint of that name is not the kit's",
      async () => {
        await this.create(TABLES.agenda);

        const statements = await this.statementsOf(TABLES.agenda.shape);

        await this.constrain('agenda', "note <> 'none'");

        const refusal = await failureOf(() => this.run(statements));
        const [found] = await this.listed(TABLES.agenda.shape).states();

        this.expect(
          String(refusal).includes('The constraint agenda_live_rows_whole of tables_contract.agenda is not written as'),
        ).toBe(true);

        this.expect(found?.constraint?.state).toBe('unexpected');
        this.expect(found?.refusing).toEqual(this.agenda.refusing);
      },
    );
  }

  private warnsOfWhatItDoesNotRead(): void {
    this.it('warns of another check constraint that names a field of the row, and of no other', async () => {
      await this.create(TABLES.checked);

      // Written for the live rows only, as the warning advises: it lets every trace in and is not named.
      await this.subject.execute(
        `alter table ${this.schema}.checked_rows add constraint checked_rows_titled check (deleted or (length(title) > 0))`,
      );

      const logger = new InMemoryLogger();
      const [found] = await this.listed(TABLES.checked.shape).states();

      await this.listed(TABLES.checked.shape).atStart(logger);

      this.expect(found?.checks).toEqual([
        { name: 'checked_rows_title_present', definition: 'CHECK ((title IS NOT NULL))' },
      ]);

      this.expect(logger.entries.map(({ level }) => level)).toEqual(['warn']);
      this.expect(logger.entries[0]?.message.includes('checked_rows_title_present')).toBe(true);
    });

    this.it('warns that a view is not a table: what its base columns refuse is not read', async () => {
      await this.create(TABLES.viewed);

      const logger = new InMemoryLogger();
      const [found] = await this.listed(TABLES.viewed.shape).states();

      await this.listed(TABLES.viewed.shape).atStart(logger);

      this.expect([found?.relation, found?.refusing]).toEqual(['view', []]);
      this.expect(logger.entries.map(({ level }) => level)).toEqual(['warn']);
    });
  }

  private triesEveryEntry(): void {
    this.it(
      'tells a table it could not read under its name, still reads the others, and starts when told to report',
      async () => {
        await this.create(TABLES.ready, TABLES.agenda);

        const tables = new ReadModelTables([
          { name: 'Unbuilt', build: () => this.unbuilt() },
          { name: 'Ready', build: () => this.subject.table(TABLES.ready.shape) },
          { name: 'Unread', build: () => ({ tableState: () => Promise.reject(new Error('permission denied')) }) },
          { name: 'Agenda', build: () => this.subject.table(TABLES.agenda.shape) },
        ]);

        const logger = new InMemoryLogger();
        const refusal = await failureOf(() => tables.atStart(logger));

        await tables.atStart(logger, 'reported');

        this.expect(
          [refusal]
            .filter((refused) => refused instanceof ReadModelTablesNotReadyError)
            .map(({ tables: unready, unread }) => [unready.map(({ state }) => state), unread.map(({ name }) => name)]),
        ).toEqual([[[this.agenda], ['Unbuilt', 'Unread']]]);

        this.expect(logger.entries.map(({ level, fields }) => [level, fields['tables'], fields['unread']])).toEqual([
          ['error', `${this.schema}.agenda`, 'Unbuilt, Unread'],
        ]);
      },
    );
  }

  private unbuilt(): never {
    throw new TypeError('no such entity');
  }

  private constrain(table: string, check: string): Promise<unknown> {
    return this.subject.execute(
      `alter table ${this.schema}.${table} add constraint ${table}_live_rows_whole check (${check})`,
    );
  }
}
