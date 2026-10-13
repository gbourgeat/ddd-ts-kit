// Run by the knex CLI under plain node, which resolves no alias: it names the compiled schema by its path.
import { addInternalNotes } from '../dist/src/contexts/scheduling/infrastructure/persistence/add-internal-notes.schema.js';

export const up = (knex) => addInternalNotes(knex);

export const down = async (knex) => {
  await knex.schema.withSchema('scheduling').alterTable('agenda', (table) => table.dropColumn('internal_note'));
  await knex.schema.withSchema('scheduling').alterTable('appointments', (table) => table.dropColumn('internal_note'));
};
