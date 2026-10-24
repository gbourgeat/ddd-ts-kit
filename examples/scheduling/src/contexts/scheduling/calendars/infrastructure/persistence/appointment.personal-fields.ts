import { personalFields, type PersonalFieldsOptions } from '@ddd-ts-kit/kernel';
import { SCHEDULING_SCHEMA } from '@/contexts/scheduling/infrastructure/persistence/scheduling.schema';
import type { AppointmentRow } from '@/contexts/scheduling/calendars/infrastructure/persistence/appointment-row.schema';

/** The table as the erasure reaches it: tenant data, every statement confined to the network of the work. */
const TABLE = { schema: SCHEDULING_SCHEMA, table: 'appointments' };

/**
 * What an appointment keeps of its patient in clear: the note the staff wrote, the reason of a
 * cancellation, and the document the patient attached, its content deleted from the file storage
 * and its key forgotten. Once the patient is erased the texts read `[erased]` and the rest of the
 * document nothing; the appointment stays, a booking is a fact of the practice and it names the
 * patient by an opaque id alone. The words sealed in the attendance records are erased by the key
 * of the patient, not here.
 */
const declaration: PersonalFieldsOptions<AppointmentRow> = {
  subject: 'patient_id',
  fields: [
    'internal_note',
    'cancellation_reason',
    'document_name',
    'document_media_type',
    'document_checksum',
    'document_size',
    'document_attached_at',
  ],
  files: ['document_key'],
  erasure: 'pseudonymise',
};

export const AppointmentPersonalFields = personalFields(TABLE, declaration);
