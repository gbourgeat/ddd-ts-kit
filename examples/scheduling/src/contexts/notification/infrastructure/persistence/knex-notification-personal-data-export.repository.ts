import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, KnexPersonalDataExport } from '@ddd-ts-kit/knex';
import { NotificationPersonalDataExport } from '@/contexts/notification/application/ports/notification-personal-data-export.port';
import { ContactPersonalFields } from '@/contexts/notification/infrastructure/persistence/contact.personal-fields';

/** The export of notification, as its declaration says: the address it reaches the person at, in the network of the work alone. */
@Repository(NotificationPersonalDataExport)
export class KnexNotificationPersonalDataExport
  extends KnexPersonalDataExport
  implements NotificationPersonalDataExport
{
  constructor(database: KnexContext, scope: ExecutionScope) {
    super(database, {
      name: 'notification',
      declarations: [
        // ddd-ts-kit:personal-fields
        ContactPersonalFields,
        // /ddd-ts-kit:personal-fields
      ],
      tenant: scope,
    });
  }
}
