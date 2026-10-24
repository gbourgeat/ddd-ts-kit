import { personalFields, type PersonalFieldsOptions } from '@ddd-ts-kit/kernel';
import { SCHEDULING_SCHEMA } from '@/contexts/scheduling/infrastructure/persistence/scheduling.schema';

/** A row of the agenda read model, as far as a person is concerned. */
interface AgendaRow {
  readonly patient_id: string;
  readonly internal_note: string | null;
}

/** The read model as the erasure reaches it: tenant data, one row per appointment. */
const TABLE = { schema: SCHEDULING_SCHEMA, table: 'agenda' };

/** The note of the staff the agenda copies from each appointment of the patient: it reads `[erased]` once the patient is erased. */
const declaration: PersonalFieldsOptions<AgendaRow> = {
  subject: 'patient_id',
  fields: ['internal_note'],
  erasure: 'pseudonymise',
};

export const AgendaPersonalFields = personalFields(TABLE, declaration);
