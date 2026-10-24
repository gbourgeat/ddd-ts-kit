import { personalFields, type PersonalFieldsOptions } from '@ddd-ts-kit/kernel';
import type { PrismaPersonalTable } from '@ddd-ts-kit/prisma';

/** The table as the erasure reaches it, by the names `@@schema` and `@@map` give it: its statements are written on the table, not through the model. */
const TABLE: PrismaPersonalTable = { schema: '{{context.schema}}', table: 'invitations' };

/**
 * What an invitation keeps of the person invited, who has no account yet and is named by the
 * invitation alone: the address it was sent to. The row leaves thirty days after the invitation
 * expired, answered or not, by the nightly purge of the platform.
 */
// The columns are named as the database spells them (`@map`), since the erasure writes SQL on the table.
const declaration: PersonalFieldsOptions<Record<string, unknown>> = {
  subject: 'id',
  fields: ['email'],
  erasure: 'row',
  retention: { after: 'expires_at', days: 30 },
};

export const InvitationPersonalFields = personalFields(TABLE, declaration);
