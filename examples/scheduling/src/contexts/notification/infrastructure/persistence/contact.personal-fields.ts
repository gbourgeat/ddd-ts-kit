import { personalFields, type PersonalFieldsOptions } from '@ddd-ts-kit/kernel';
import { NOTIFICATION_SCHEMA } from '@/contexts/notification/infrastructure/persistence/notification.schema';

/** A row of the contacts projection, as the database holds it. */
interface ContactRow {
  readonly recipient_id: string;
  readonly address: string;
}

/** The read model as the register and the export reach it: tenant data, one row per recipient. */
const TABLE = { schema: NOTIFICATION_SCHEMA, table: 'contacts' };

/**
 * What notification keeps of a person in clear: the address it reaches them at, copied from
 * `identity.person.registered`. The row of the recipient leaves once that person is erased, under a
 * stamp of that instant (`KnexNotificationPersonalDataErasure`), so that the announcement, delivered
 * again later, does not bring the address back.
 */
const declaration: PersonalFieldsOptions<ContactRow> = {
  subject: 'recipient_id',
  fields: ['address'],
  erasure: 'row',
};

export const ContactPersonalFields = personalFields(TABLE, declaration);
