import type { Knex } from 'knex';
import { schemaNameOf } from '@ddd-ts-kit/knex';

export const {{context.constant}}_SCHEMA = schemaNameOf('{{context.kebab}}');

export async function create{{context.pascal}}Tables(knex: Knex): Promise<void> {
  await knex.schema.createSchemaIfNotExists({{context.constant}}_SCHEMA);
  // ddd-ts-kit:tables
  // /ddd-ts-kit:tables
}

// ddd-ts-kit:definitions
// /ddd-ts-kit:definitions
