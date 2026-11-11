import type { Knex } from 'knex';
import { ReadModelTableNotReadyError } from '@ddd-ts-kit/kernel';
import { TENANT_COLUMN } from '../tenancy/where-tenant';
import type { KnexReadModelOptions } from './knex-read-model-options';

/**
 * Whether the table of a read model can hold the trace of a deleted row: every column of the
 * row accepts NULL, the key and the tenant apart. The columns are read once, before the first
 * write of a trace, so a table that is not ready is refused by name instead of by a statement
 * that would abort the transaction of the event; the copy of a rebuild is made like the table.
 */
export class TraceColumns<Row> {
  private ready = false;

  constructor(private readonly options: KnexReadModelOptions<Row>) {}

  async require(executor: Knex): Promise<void> {
    if (this.ready) {
      return;
    }

    const { schema, table } = this.options;
    const described: Readonly<Record<string, Knex.ColumnInfo | undefined>> = await this.columnsOn(executor);
    const refusing = this.data().filter((column) => described[column]?.nullable === false);

    if (refusing.length > 0) {
      throw new ReadModelTableNotReadyError(schema === undefined ? table : `${schema}.${table}`, refusing);
    }

    this.ready = true;
  }

  private columnsOn(executor: Knex): Promise<Record<string, Knex.ColumnInfo>> {
    const { schema, table } = this.options;
    const builder = executor(table);

    return (schema === undefined ? builder : builder.withSchema(schema)).columnInfo();
  }

  /** The columns of the row, in which a trace holds NULL. */
  private data(): string[] {
    const { columns, keyColumn = 'id', tenant } = this.options;
    const kept = new Set([keyColumn, ...(tenant === undefined ? [] : [TENANT_COLUMN])]);

    return Object.values<string>(columns).filter((column) => !kept.has(column));
  }
}
