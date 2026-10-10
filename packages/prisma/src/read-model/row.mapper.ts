const STAMP_COLUMNS = {
  lastEventId: 'last_event_id',
  lastEventAt: 'last_event_at',
  lastEventVersion: 'last_event_version',
  deleted: 'deleted',
} as const;

/**
 * Translates between the row of a read model and what Prisma holds: the model, keyed by
 * field, and the table, keyed by column, which is how the copy of a rebuild is reached since
 * it has no model. A `Decimal` reads back as a string, a `BigInt` as a number.
 */
export class RowMapper<Row extends object> {
  constructor(private readonly columns: Readonly<Record<string, string>>) {}

  /** From what the model answered, by field. */
  toRow(found: object): Row {
    return Object.fromEntries(
      Object.keys(this.columns).map((field) => [field, plain(Reflect.get(found, field))]),
    ) as Row;
  }

  /** From a record of the table, by column. */
  fromRecord(record: Readonly<Record<string, unknown>>): Row {
    return Object.fromEntries(
      Object.entries(this.columns).map(([field, column]) => [field, plain(record[column])]),
    ) as Row;
  }

  /** What the model wrote by field, by column: the fields of the row and the four stamps. */
  toRecord(written: Readonly<Record<string, unknown>>): Record<string, unknown> {
    const columns: Readonly<Record<string, string>> = { ...this.columns, ...STAMP_COLUMNS };

    return Object.fromEntries(
      Object.entries(written).map(([field, value]) => [
        columns[field] ?? field,
        typeof value === 'bigint' ? Number(value) : value,
      ]),
    );
  }

  columnOf(field: string): string {
    const column = Object.hasOwn(this.columns, field) ? this.columns[field] : undefined;

    if (column === undefined) {
      throw new Error(`The field "${field}" is mapped to no column`);
    }

    return column;
  }
}

function plain(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  return isDecimal(value) ? value.toFixed() : value;
}

/** A `Decimal` of Prisma, read as digits without an exponent. */
function isDecimal(value: unknown): value is { toFixed(): string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !(value instanceof Date) &&
    'toFixed' in value &&
    typeof value.toFixed === 'function'
  );
}
