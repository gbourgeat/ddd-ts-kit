/** Translates between the row of a read model, keyed by field, and the record of its table, keyed by column. */
export class RowMapper<Row extends object> {
  constructor(private readonly columns: Readonly<Record<string, string>>) {}

  toRow(record: Readonly<Record<string, unknown>>): Row {
    return Object.fromEntries(
      Object.entries(this.columns).map(([field, column]) => [field, record[column] ?? null]),
    ) as Row;
  }

  toRecord(row: Row): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(this.columns).map(([field, column]) => {
        const value: unknown = Reflect.get(row, field);

        return [column, value === undefined ? null : value];
      }),
    );
  }
}
