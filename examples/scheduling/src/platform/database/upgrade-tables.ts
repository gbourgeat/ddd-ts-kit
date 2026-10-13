import type { Knex } from 'knex';
import { addAppointmentDocuments } from '@/contexts/scheduling/infrastructure/persistence/add-appointment-documents.schema';

/**
 * Every change of a table made once the first migration was shared, in the order of the
 * migrations that apply them: the in-process database of the tests runs them after `createTables`.
 */
export const upgradeTables = async (knex: Knex): Promise<void> => {
  await addAppointmentDocuments(knex);
};
