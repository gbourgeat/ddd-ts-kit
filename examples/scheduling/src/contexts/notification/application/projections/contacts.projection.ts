import { stampOf } from '@ddd-ts-kit/kernel';
import { On, Projection } from '@ddd-ts-kit/kernel/declarations';
import { personRegisteredV1, type PersonRegisteredV1 } from '@/contexts/identity/published-language/index.js';
import { storableStamp } from '@/shared-kernel/storable-stamp.js';
import { Contacts } from '@/contexts/notification/application/ports/contacts.port.js';

@Projection('notification.contacts', [Contacts])
export class ContactsProjection {
  constructor(private readonly contacts: Contacts) {}

  @On(personRegisteredV1)
  registered(event: PersonRegisteredV1) {
    const { personId, email } = event.payload;

    return this.contacts.upsertIfNewer(personId, storableStamp(stampOf(event)), () => ({
      recipientId: personId,
      address: email,
    }));
  }
}
