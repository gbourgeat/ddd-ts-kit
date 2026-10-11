import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, KnexReadModelStore } from '@ddd-ts-kit/knex';
import { Contacts, contactCriteria, type Contact } from '@/contexts/notification/application/ports/contacts.port';
import { NOTIFICATION_SCHEMA } from '@/contexts/notification/infrastructure/persistence/notification.schema';

@Repository(Contacts, [KnexContext])
export class KnexContacts extends KnexReadModelStore<Contact> implements Contacts {
  constructor(context: KnexContext) {
    super(context, {
      schema: NOTIFICATION_SCHEMA,
      table: 'contacts',
      keyColumn: 'recipient_id',
      columns: { recipientId: 'recipient_id', address: 'address' },
      definition: contactCriteria,
    });
  }
}
