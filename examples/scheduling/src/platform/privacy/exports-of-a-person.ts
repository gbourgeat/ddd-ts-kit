import type { ExecutionScope, PersonalDataExport } from '@ddd-ts-kit/kernel';
import type { Persistence } from '@/platform/database/persistence';
import { KnexIdentityPersonalDataExport } from '@/contexts/identity/infrastructure/persistence/knex-identity-personal-data-export.repository';
import { KnexNotificationPersonalDataExport } from '@/contexts/notification/infrastructure/persistence/knex-notification-personal-data-export.repository';
import { KnexSchedulingPersonalDataExport } from '@/contexts/scheduling/calendars/infrastructure/persistence/knex-scheduling-personal-data-export.repository';

/**
 * Every export of what the contexts keep of a person, each the `PersonalDataExport` of its context
 * over the same `personalFields` declarations as its erasure, in the order the document lists
 * them: identity, notification, scheduling.
 */
export function exportsOfAPerson(persistence: Persistence, scope: ExecutionScope): PersonalDataExport[] {
  return [
    new KnexIdentityPersonalDataExport(persistence.database, scope),
    new KnexNotificationPersonalDataExport(persistence.database, scope),
    new KnexSchedulingPersonalDataExport(persistence.database, scope),
  ];
}
