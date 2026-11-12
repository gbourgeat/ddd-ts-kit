import { InMemoryReadModelStore } from '@ddd-ts-kit/kernel';
import { contactCriteria, type Contact, type Contacts } from '@/contexts/notification/application/ports/contacts.port';
import { storableStamp } from '@/shared-kernel/storable-stamp';

export class FakeContacts extends InMemoryReadModelStore<Contact> implements Contacts {
  constructor() {
    super(contactCriteria);
  }

  /** Makes a recipient reachable at an address, as if identity had announced it at the beginning of time. */
  async know(recipientId: string, address: string): Promise<void> {
    const known = storableStamp({ eventId: 'known-' + recipientId, occurredAt: new Date(0) });

    await this.upsertIfNewer(recipientId, known, () => ({ recipientId, address }));
  }
}
