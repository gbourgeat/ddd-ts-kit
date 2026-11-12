import {
  InMemoryLogger,
  ReadModelTables,
  ReadModelTablesNotReadyError,
  type ReadModelInATable,
} from '@ddd-ts-kit/kernel';
import type { Awaitable } from '../awaitable';
import type { ContractRunner } from '../contract-runner';
import { failureOf } from '../failure-of';
import type { ReadModelTableShape } from './read-model-table-shape';
import { READ_MODEL_TABLE_SHAPES as TABLES } from './read-model-table-shapes';
import type { ReadModelTablesUnderContract } from './read-model-tables-under-contract';
import { ReadModelTablesSuite } from './read-model-tables-suite';

const ALL = [TABLES.ready, TABLES.agenda, TABLES.contacts] as const;

/**
 * The start of an application reads the tables it lists and no other: a table nobody lists, one
 * of another schema that carries the stamp included, changes nothing; a listed table that is not
 * ready refuses the start with one error that names them all, or is told as one error.
 */
export class TablesAtStartSuite extends ReadModelTablesSuite {
  constructor(
    runner: ContractRunner,
    createTables: () => Awaitable<ReadModelTablesUnderContract>,
    private readonly unreachable?: (
      shape: ReadModelTableShape,
    ) => Awaitable<{ readonly table: ReadModelInATable; close(): Awaitable<unknown> } | undefined>,
  ) {
    super(runner, createTables);
  }

  protected tests(): void {
    this.readsTheListAlone();
    this.refusesOrReports();
    this.startsWithoutItsDatabase();
  }

  private startsWithoutItsDatabase(): void {
    const { unreachable } = this;

    if (unreachable === undefined) {
      this.todo('starts with one warning when the database cannot be reached (the member connects before any table)');

      return;
    }

    this.it('starts with one warning, its cause in a few words, when the database cannot be reached', async () => {
      const closed = await unreachable(TABLES.ready.shape);
      const tables = new ReadModelTables([{ name: 'Closed', build: () => closed?.table ?? {} }]);
      const logger = new InMemoryLogger();

      try {
        await tables.atStart(logger);
        await tables.atStart(logger, 'reported');

        const said = logger.entries.map(({ level, message }) => `${level}: ${message}`);

        this.expect(said.length).toBe(2);

        this.expect(said.every((line) => line.startsWith('warn: The read model tables could not be checked'))).toBe(
          true,
        );

        this.expect(said.join('').includes('select ')).toBe(false);
        this.expect((await tables.report()).outcome).toBe('unread');
      } finally {
        await closed?.close();
      }
    });
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
