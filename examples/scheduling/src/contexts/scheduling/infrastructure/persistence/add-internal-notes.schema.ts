import type { Knex } from 'knex';
import { SCHEDULING_SCHEMA } from '@/contexts/scheduling/infrastructure/persistence/scheduling.schema';

/**
 * The internal note of an appointment, added once the tables were shared: kept with the
 * appointment, and copied into the agenda that shows it to the staff of the practice.
 */
export const addInternalNotes = async (knex: Knex): Promise<void> => {
  await knex.schema.withSchema(SCHEDULING_SCHEMA).alterTable('appointments', (table) => {
    table.text('internal_note');
  });

  await knex.schema.withSchema(SCHEDULING_SCHEMA).alterTable('agenda', (table) => {
    table.text('internal_note');
  });
};
