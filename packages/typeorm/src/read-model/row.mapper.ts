import type { Driver, EntityMetadata } from 'typeorm';

type ColumnMetadata = EntityMetadata['columns'][number];

const STAMPS = new Set(['lastEventId', 'lastEventAt', 'lastEventVersion', 'deleted']);

/**
 * Translates between the row of a read model, keyed by property, and the record of its
 * table, keyed by column name, through the driver: the copy of a rebuild has no entity of its
 * own, so its rows are read and written by column.
 */
export class RowMapper<Row extends object> {
  private readonly fields: readonly ColumnMetadata[];

  constructor(
    private readonly driver: Driver,
    private readonly columns: readonly ColumnMetadata[],
  ) {
    this.fields = columns.filter((column) => !STAMPS.has(column.propertyName));
  }

  toRow(record: Readonly<Record<string, unknown>>): Row {
    return Object.fromEntries(this.fields.map((column) => [column.propertyName, this.read(record, column.propertyName)])) as Row;
  }

  /** The row of an entity the query builder hydrated: its fields, without the stamps. */
  fromEntity(entity: object): Row {
    return Object.fromEntries(this.fields.map((column) => [column.propertyName, (Reflect.get(entity, column.propertyName) as unknown) ?? null])) as Row;
  }

  toRecord(properties: Readonly<Record<string, unknown>>): Record<string, unknown> {
    const written = this.columns.filter((column) => Object.hasOwn(properties, column.propertyName));

    return Object.fromEntries(
      written.map((column) => [column.databaseName, this.driver.preparePersistentValue(properties[column.propertyName] ?? null, column) as unknown]),
    );
  }

  /** What the column of a property holds in a record, as the entity would hold it. */
  read(record: Readonly<Record<string, unknown>>, property: string): unknown {
    const column = this.columns.find((candidate) => candidate.propertyName === property);
    const value = column === undefined ? undefined : record[column.databaseName];

    return column === undefined || value === null || value === undefined ? null : (this.driver.prepareHydratedValue(value, column) as unknown);
  }

  columnOf(property: string): string {
    const column = this.columns.find((candidate) => candidate.propertyName === property);

    if (column === undefined) throw new Error(`The entity of the read model has no property "${property}"`);

    return column.databaseName;
  }
}
