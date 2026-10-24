import type { Clock, ExecutionScope, FileStorage, PersonalDataErasure } from '@ddd-ts-kit/kernel';
import type { Persistence } from '@/platform/database/persistence';
import { KnexIdentityPersonalDataErasure } from '@/contexts/identity/infrastructure/persistence/knex-identity-personal-data-erasure.repository';
import { KnexNotificationPersonalDataErasure } from '@/contexts/notification/infrastructure/persistence/knex-notification-personal-data-erasure.repository';
import { KnexSchedulingPersonalDataErasure } from '@/contexts/scheduling/calendars/infrastructure/persistence/knex-scheduling-personal-data-erasure.repository';

export interface ErasureTools {
  readonly scope: ExecutionScope;
  readonly clock: Clock;
  /** Where the documents attached to the appointments of the person live. */
  readonly files: FileStorage;
}

/**
 * Every copy of a person the contexts keep in clear, each the `PersonalDataErasure` of its
 * context over the `personalFields` declarations of its tables, in the order the platform runs
 * them in each network: identity forgets the person (name and address), notification forgets the
 * address it reached them at, scheduling pseudonymises the notes and the cancellation reasons of
 * their appointments, deletes the documents attached to them and pseudonymises the name the
 * practitioner directory copied. What is sealed in the event store is erased by the key, before
 * these copies; what was published to other systems is not reached: see the README.
 */
export function copiesOfAPerson(
  persistence: Persistence,
  { scope, clock, files }: ErasureTools,
): PersonalDataErasure[] {
  return [
    new KnexIdentityPersonalDataErasure(persistence.database, scope),
    new KnexNotificationPersonalDataErasure(persistence.database, scope, clock),
    new KnexSchedulingPersonalDataErasure(persistence.database, scope, files),
  ];
}
