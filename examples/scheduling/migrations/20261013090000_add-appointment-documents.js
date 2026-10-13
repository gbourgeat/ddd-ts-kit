// Run by the knex CLI under plain node, which resolves no alias: it names the compiled schema by its path.
import { addAppointmentDocuments } from '../dist/src/contexts/scheduling/infrastructure/persistence/add-appointment-documents.schema.js';

export const up = (knex) => addAppointmentDocuments(knex);

export const down = (knex) =>
  knex.schema
    .withSchema('scheduling')
    .alterTable('appointments', (table) =>
      table.dropColumns(
        'document_key',
        'document_size',
        'document_media_type',
        'document_checksum',
        'document_name',
        'document_attached_at',
      ),
    );
