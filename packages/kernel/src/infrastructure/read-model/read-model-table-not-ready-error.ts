/**
 * The table of a read model has columns that refuse NULL, so it cannot hold the trace of a
 * deleted row: its key, its stamp and `deleted`, NULL in every other column. An adapter raises it
 * from the definition of the table or from one read of its columns, before any statement the
 * database would refuse, since on PostgreSQL that refusal aborts the transaction of the event.
 */
export class ReadModelTableNotReadyError extends Error {
  constructor(
    readonly table: string,
    readonly columns: readonly string[],
  ) {
    const named = columns.map((column) => `"${column}"`);
    const whole = named.map((column) => `${column} is not null`).join(' and ');

    super(
      `The read model table ${table} cannot hold the trace of a deleted row: ${named.join(', ')} ${columns.length === 1 ? 'refuses' : 'refuse'} NULL, and a deleted row keeps its key and its stamp only. Write a migration that drops NOT NULL there (alter table ${table} alter column <column> drop not null) and keeps the live rows whole with a check constraint: check (deleted or (${whole}))`,
    );

    this.name = 'ReadModelTableNotReadyError';
  }
}
