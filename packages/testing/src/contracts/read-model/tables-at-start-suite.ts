import { InMemoryLogger, ReadModelTablesNotReadyError } from '@ddd-ts-kit/kernel';
import { failureOf } from '../failure-of';
import { READ_MODEL_TABLE_SHAPES as TABLES } from './read-model-table-shapes';
import { ReadModelTablesSuite } from './read-model-tables-suite';

const ALL = [TABLES.ready, TABLES.agenda, TABLES.contacts] as const;

/**
 * The start of an application reads the tables it lists and no other: a table nobody lists, one
 * of another schema that carries the stamp included, changes nothing; a listed table that is not
 * ready refuses the start with one error that names them all, or is told as one error.
 */
export class TablesAtStartSuite extends ReadModelTablesSuite {
  protected tests(): void {
    this.readsTheListAlone();
    this.refusesOrReports();
  }

  private readsTheListAlone(): void {
    this.it(
      'never reads a table nobody lists: one of another schema that carries the stamp changes nothing',
      async () => {
        await this.create(TABLES.ready);
        await this.subject.execute(TABLES.agenda.created.replace(`${this.schema}.`, `${this.elsewhere}.`));

        const logger = new InMemoryLogger();

        await this.listed(TABLES.ready.shape).atStart(logger);
        await this.listed().atStart(logger);

        this.expect(logger.entries).toEqual([]);
        this.expect(await this.listed().states()).toEqual([]);
      },
    );
  }

  private refusesOrReports(): void {
    this.it('refuses the start of an application with one error that names every listed table not ready', async () => {
      await this.create(...ALL);

      const logger = new InMemoryLogger();
      const refusal = await failureOf(() => this.listed(...ALL.map(({ shape }) => shape)).atStart(logger));

      this.expect(
        [refusal]
          .filter((refused) => refused instanceof ReadModelTablesNotReadyError)
          .flatMap(({ tables }) => tables.map(({ state }) => state)),
      ).toEqual([this.agenda, this.contacts]);

      this.expect(logger.entries).toEqual([]);
    });

    this.it('reports the same as one error and lets the start go on, when the application says so', async () => {
      await this.create(...ALL);

      const logger = new InMemoryLogger();

      await this.listed(...ALL.map(({ shape }) => shape)).atStart(logger, 'reported');

      this.expect(logger.entries.map(({ level, fields }) => [level, fields['tables']])).toEqual([
        ['error', `${this.schema}.agenda, ${this.schema}.contacts`],
      ]);
    });
  }
}
