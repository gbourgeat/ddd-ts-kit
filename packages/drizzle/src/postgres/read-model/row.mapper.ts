import type { PgColumn } from 'drizzle-orm/pg-core';

type Columns = Readonly<Record<string, PgColumn>>;

/** Translates between the row of a read model, keyed by field, and what its columns hold. */
export class RowMapper<Row extends object> {
  constructor(private readonly columns: Columns) {}

  /** From a record keyed by column name, as a statement written in SQL answers it. */
  toRow(record: Readonly<Record<string, unknown>>): Row {
    return Object.fromEntries(
      Object.entries(this.columns).map(([field, column]) => [field, decoded(column, record[column.name])]),
    ) as Row;
  }

  /** From a record keyed by field, already decoded: what `select(columns)` of the query builder answers. */
  fromSelected(selected: Readonly<Record<string, unknown>>): Row {
    return Object.fromEntries(Object.keys(this.columns).map((field) => [field, selected[field] ?? null])) as Row;
  }

  /** The values of the row by column, encoded as the driver expects them. */
  toValues(row: Row): [PgColumn, unknown][] {
    return Object.entries(this.columns).map(([field, column]) => [column, encoded(column, Reflect.get(row, field))]);
  }
}

function decoded(column: PgColumn, value: unknown): unknown {
  return value === null || value === undefined ? null : column.mapFromDriverValue(value);
}

function encoded(column: PgColumn, value: unknown): unknown {
  return value === null || value === undefined ? null : column.mapToDriverValue(value);
}
