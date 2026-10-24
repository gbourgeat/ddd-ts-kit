import { personalFields, type PersonalFieldsOptions } from '@ddd-ts-kit/kernel';
import { SCHEDULING_SCHEMA } from '@/contexts/scheduling/infrastructure/persistence/scheduling.schema';

/** A row of the practitioner directory, as far as a person is concerned. */
interface PractitionerRow {
  readonly practitioner_id: string;
  readonly display_name: string;
}

/** The read model as the erasure reaches it: tenant data, one row per practitioner of a practice. */
const TABLE = { schema: SCHEDULING_SCHEMA, table: 'practitioners' };

/** The name the directory copied from `identity.practice.member-added`: it reads `[erased]` once the practitioner is erased. */
const declaration: PersonalFieldsOptions<PractitionerRow> = {
  subject: 'practitioner_id',
  fields: ['display_name'],
  erasure: 'pseudonymise',
};

export const PractitionerPersonalFields = personalFields(TABLE, declaration);
