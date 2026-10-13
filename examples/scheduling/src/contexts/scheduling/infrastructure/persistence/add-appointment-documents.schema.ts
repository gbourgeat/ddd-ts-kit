import type { Knex } from 'knex';
import { SCHEDULING_SCHEMA } from '@/contexts/scheduling/infrastructure/persistence/scheduling.schema';

/**
 * The reference of the document of an appointment, added once the table was shared: the key, the
 * size, the media type and the checksum of the stored file, its name and when it was attached.
 * Never its content, which lives in the file storage (`persistence/no-file-content`).
 */
export const addAppointmentDocuments = (knex: Knex): Promise<void> =>
  knex.schema.withSchema(SCHEDULING_SCHEMA).alterTable('appointments', (table) => {
    table.text('document_key');
    table.integer('document_size');
    table.text('document_media_type');
    table.text('document_checksum');
    table.text('document_name');
    table.timestamp('document_attached_at', { useTz: true });
  });
