import { NotADataSubjectIdError, isDataSubjectId, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext } from '@ddd-ts-kit/knex';
import { NotificationPersonalDataErasure } from '@/contexts/notification/application/ports/notification-personal-data-erasure.port';
import { KnexContacts } from '@/contexts/notification/infrastructure/persistence/knex-contacts.repository';
import { storableStamp } from '@/shared-kernel/storable-stamp';

/**
 * The erasure of notification, as `contact.personal-fields.ts` declares it: the contact of the
 * person deleted, in the network of the work alone, under a stamp of this instant. The row keeps
 * the stamp, so the announcement that created it, delivered again later, does not bring the address
 * back; the generic erasure of the kit would delete it without one. Running it again reaches nothing.
 */
@Repository(NotificationPersonalDataErasure)
export class KnexNotificationPersonalDataErasure implements NotificationPersonalDataErasure {
  readonly name = 'notification';

  private readonly contacts: KnexContacts;

  constructor(
    database: KnexContext,
    scope: ExecutionScope,
    private readonly clock: Clock,
  ) {
    this.contacts = new KnexContacts(database, scope);
  }

  async erase(personId: string): Promise<number> {
    if (!isDataSubjectId(personId)) {
      throw new NotADataSubjectIdError();
    }

    const stamp = storableStamp({ eventId: `erasure:${personId}`, occurredAt: this.clock.now() });

    return (await this.contacts.delete(personId, stamp)) === 'applied' ? 1 : 0;
  }
}
