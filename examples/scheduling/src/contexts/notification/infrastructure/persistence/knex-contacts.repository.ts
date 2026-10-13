import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, KnexReadModelStore } from '@ddd-ts-kit/knex';
import { Contacts, contactCriteria, type Contact } from '@/contexts/notification/application/ports/contacts.port';
import { NOTIFICATION_SCHEMA } from '@/contexts/notification/infrastructure/persistence/notification.schema';

@Repository(Contacts)
export class KnexContacts extends KnexReadModelStore<Contact> implements Contacts {
  /** Tenant data: every row is written in, and every read confined to, the tenant of the work. */
  constructor(context: KnexContext, scope: ExecutionScope) {
    super(context, {
      tenant: scope,
      schema: NOTIFICATION_SCHEMA,
      table: 'contacts',
      keyColumn: 'recipient_id',
      columns: { recipientId: 'recipient_id', address: 'address' },
      definition: contactCriteria,
    });
  }
}
