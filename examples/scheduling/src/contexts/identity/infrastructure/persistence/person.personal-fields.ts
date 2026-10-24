import { personalFields, type PersonalFieldsOptions } from '@ddd-ts-kit/kernel';
import { IDENTITY_SCHEMA } from '@/contexts/identity/infrastructure/persistence/identity.schema';
import type { PersonRow } from '@/contexts/identity/infrastructure/persistence/person-row.schema';

/** The table as the erasure reaches it: tenant data, every statement confined to the network of the work. */
const TABLE = { schema: IDENTITY_SCHEMA, table: 'persons' };

/**
 * What identity keeps of a person in clear: the name and the address. The row of the person is
 * deleted once that person is erased; a membership, a delegation or an appointment names the person
 * by id alone and stays, the id says nothing of who the person was.
 */
const declaration: PersonalFieldsOptions<PersonRow> = {
  subject: 'id',
  fields: ['display_name', 'email'],
  erasure: 'row',
};

export const PersonPersonalFields = personalFields(TABLE, declaration);
