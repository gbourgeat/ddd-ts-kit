import { personalFields, type PersonalFieldsOptions } from '@ddd-ts-kit/kernel';
import type { PrismaPersonalTable } from '@ddd-ts-kit/prisma';

/** The table as the erasure reaches it, by the names `@@schema` and `@@map` give it: its statements are written on the table, not through the model. */
const TABLE: PrismaPersonalTable = { schema: '{{context.schema}}', table: 'accounts' };

/**
 * What an account keeps of the person it is, named by the subject the identity provider gives
 * them: the address and the name read `[erased]` once that person is erased, and the account stays,
 * deactivated or not, for the members and the delegations that name it.
 */
// The columns are named as the database spells them (`@map`), since the erasure writes SQL on the table.
const declaration: PersonalFieldsOptions<Record<string, unknown>> = {
  subject: 'id',
  fields: ['email', 'display_name'],
  erasure: 'pseudonymise',
};

export const AccountPersonalFields = personalFields(TABLE, declaration);
