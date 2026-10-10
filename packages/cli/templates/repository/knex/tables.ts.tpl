// ddd-ts-kit:imports
import type { Knex } from 'knex';
import { {{context.constant}}_SCHEMA } from './{{context.kebab}}.schema.js';
// /ddd-ts-kit:imports

export async function create{{context.pascal}}Tables(knex: Knex): Promise<void> {
  await knex.schema.createSchemaIfNotExists({{context.constant}}_SCHEMA);
  // ddd-ts-kit:tables
  // /ddd-ts-kit:tables
}

// ddd-ts-kit:definitions
// /ddd-ts-kit:definitions
