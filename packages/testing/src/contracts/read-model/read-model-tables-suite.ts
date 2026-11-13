import { ReadModelTableNotReadyError, ReadModelTables, type ReadModelTableState } from '@ddd-ts-kit/kernel';
import type { Awaitable } from '../awaitable';
import type { ContractRunner } from '../contract-runner';
import { ContractSuite } from '../contract-suite';
import { failureOf } from '../failure-of';
import type { ReadModelTableShape } from './read-model-table-shape';
import { READ_MODEL_TABLE_SHAPES as TABLES } from './read-model-table-shapes';
import type { ReadModelTablesUnderContract } from './read-model-tables-under-contract';

const STAMP = { eventId: 'evt-1', occurredAt: new Date('2026-11-12T09:00:00.000Z') };

/**
 * What the suites of the read model tables contract share: the schema of the contract and one
 * that belongs to somebody else, both empty before each test, the tables as an application lists
 * them, and the comparison of what the list says with what the store does.
 */
export abstract class ReadModelTablesSuite extends ContractSuite<ReadModelTablesUnderContract> {
  protected readonly schema = TABLES.schema;

  /** A schema of the same database that belongs to somebody else. */
  protected readonly elsewhere = `${TABLES.schema}_elsewhere`;

  protected readonly agenda = this.expected('agenda', {
    refusing: ['status', 'starts_at'],
    row: ['status', 'starts_at', 'note'],
  });

  protected readonly contacts = this.expected('contacts', {
    refusing: ['address'],
    row: ['address', 'label'],
    constraint: { state: 'held', columns: ['label'] },
  });

  constructor(runner: ContractRunner, createTables: () => Awaitable<ReadModelTablesUnderContract>) {
    super(runner, async () => {
      const subject = await createTables();

      for (const schema of [TABLES.schema, `${TABLES.schema}_elsewhere`]) {
        await subject.execute(`drop schema if exists ${schema} cascade`);
        await subject.execute(`create schema ${schema}`);
      }

      return subject;
    });
  }

  /** What the contract expects of a table: ready and without a constraint unless said; `unread` where the database was not asked for the constraint. */
  protected expected(table: string, found: Partial<ReadModelTableState>, constraint?: 'unread'): ReadModelTableState {
    const read = {
      schema: TABLES.schema,
      table,
      exists: true,
      refusing: [],
      unfit: [],
      row: [],
      deleted: 'deleted',
      ...found,
    };

    return constraint === 'unread' ? read : { constraint: { state: 'missing', columns: [] }, ...read };
  }

  protected listed(...shapes: readonly ReadModelTableShape[]): ReadModelTables {
    return new ReadModelTables(shapes.map((shape) => ({ name: shape.table, build: () => this.subject.table(shape) })));
  }

  /** What the store answers to the trace of a deleted row under a key it does not hold: nothing when it wrote it. */
  protected traced(shape: ReadModelTableShape): Promise<unknown> {
    return failureOf(() =>
      this.subject.table(shape).insert({ key: `trace-of-${shape.table}`, row: undefined, stamp: STAMP }),
    );
  }

  /**
   * The list and the store say the same of the table: this state, read by both, and a refusal
   * of the store exactly when the list finds the table not ready. Answers that refusal.
   */
  protected async agrees(
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

  protected async create(...tables: readonly { readonly created: string; readonly first?: string }[]): Promise<void> {
    for (const { created, first } of tables) {
      await this.run([...(first === undefined ? [] : [first]), ...(created.endsWith('()') ? [] : [created])]);
    }
  }

  protected async statementsOf(shape: ReadModelTableShape): Promise<readonly string[]> {
    return [await this.traced(shape)]
      .filter((refusal) => refusal instanceof ReadModelTableNotReadyError)
      .flatMap((refusal) => refusal.statements);
  }

  /** Runs the migration the store writes for the table, each statement as it is, and answers it. */
  protected async migrate({ shape }: { readonly shape: ReadModelTableShape }): Promise<readonly string[]> {
    const statements = await this.statementsOf(shape);

    await this.run(statements);

    return statements;
  }

  protected async run(statements: readonly string[]): Promise<void> {
    for (const statement of statements) {
      await this.subject.execute(statement);
    }
  }

  /** The columns of a table that refuse NULL, read in the catalog. */
  protected async refusingNull(table: string): Promise<string[]> {
    const columns = await this.subject.execute(
      `select attname as "column" from pg_attribute where attrelid = to_regclass('${TABLES.schema}.${table}') and attnotnull and attnum > 0 and not attisdropped order by attname`,
    );

    return columns.map((column) => String(column['column']));
  }
}
