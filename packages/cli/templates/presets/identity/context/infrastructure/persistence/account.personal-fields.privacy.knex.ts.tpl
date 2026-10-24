import { personalFields, type PersonalFieldsOptions } from '@ddd-ts-kit/kernel';
import { {{context.constant}}_SCHEMA } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import type { AccountRow } from '{{alias.context}}/infrastructure/persistence/account-row.schema{{alias.ext}}';

/** The table as the erasure reaches it: its statements are written on the table. */
const TABLE = { schema: {{context.constant}}_SCHEMA, table: 'accounts' };

/**
 * What an account keeps of the person it is, named by the subject the identity provider gives
 * them: the address and the name read `[erased]` once that person is erased, and the account stays,
 * deactivated or not, for the members and the delegations that name it.
 */
const declaration: PersonalFieldsOptions<AccountRow> = {
  subject: 'id',
  fields: ['email', 'display_name'],
  erasure: 'pseudonymise',
};

export const AccountPersonalFields = personalFields(TABLE, declaration);
