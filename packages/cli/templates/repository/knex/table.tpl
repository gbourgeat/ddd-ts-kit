@@tables
await create{{aggregate.pascal}}Table(knex);
@@definitions
export interface {{aggregate.pascal}}Row {
  readonly id: string;
  readonly created_at: Date;
  readonly version: number;
}
function create{{aggregate.pascal}}Table(knex: Knex): Promise<void> {
  return knex.schema.withSchema({{context.constant}}_SCHEMA).createTable('{{aggregate.table}}', (table) => {
    table.text('id').primary();
    table.timestamp('created_at', { useTz: true }).notNullable();
    // TODO(domain): add one column per field of {{aggregate.pascal}}State (and to {{aggregate.pascal}}Row above), with the type and the constraints the storage must enforce.
    table.integer('version').notNullable();
  });
}
