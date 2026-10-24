import { personalFields, type PersonalFieldsOptions } from '@ddd-ts-kit/kernel';
import { {{context.constant}}_SCHEMA } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import type { InvitationRow } from '{{alias.context}}/infrastructure/persistence/invitation-row.schema{{alias.ext}}';

/** The table as the erasure reaches it: its statements are written on the table. */
const TABLE = { schema: {{context.constant}}_SCHEMA, table: 'invitations' };

/**
 * What an invitation keeps of the person invited, who has no account yet and is named by the
 * invitation alone: the address it was sent to. The row leaves thirty days after the invitation
 * expired, answered or not, by the nightly purge of the platform.
 */
const declaration: PersonalFieldsOptions<InvitationRow> = {
  subject: 'id',
  fields: ['email'],
  erasure: 'row',
  retention: { after: 'expires_at', days: 30 },
};

export const InvitationPersonalFields = personalFields(TABLE, declaration);
