import type { Knex } from 'knex';

export function builderIn(knex: Knex, schema: string | undefined): Knex.SchemaBuilder {
  return schema === undefined ? knex.schema : knex.schema.withSchema(schema);
}
