import { personalFields, type PersonalFieldsOptions } from '@ddd-ts-kit/kernel';
import { accounts } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import type { AccountRow } from '{{alias.context}}/infrastructure/persistence/account-row.schema{{alias.ext}}';

/**
 * What an account keeps of the person it is, named by the subject the identity provider gives
 * them: the address and the name read `[erased]` once that person is erased, and the account stays,
 * deactivated or not, for the members and the delegations that name it.
 */
const declaration: PersonalFieldsOptions<AccountRow> = {
  subject: 'id',
  fields: ['email', 'displayName'],
  erasure: 'pseudonymise',
};

export const AccountPersonalFields = personalFields(accounts, declaration);
