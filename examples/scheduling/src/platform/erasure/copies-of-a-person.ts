import type { Clock, ExecutionScope, FileStorage } from '@ddd-ts-kit/kernel';
import type { Persistence } from '@/platform/database/persistence';
import type { ErasureStep } from '@/platform/erasure/erasure-step';
import { storableStamp } from '@/shared-kernel/storable-stamp';
import { KnexPersonRepository } from '@/contexts/identity/infrastructure/persistence/knex-person.repository';
import { KnexContacts } from '@/contexts/notification/infrastructure/persistence/knex-contacts.repository';
import type { PatientErasure } from '@/contexts/scheduling/calendars/application/ports/patient-erasure.port';
import { KnexPatientErasure } from '@/contexts/scheduling/calendars/infrastructure/persistence/knex-patient-erasure.repository';

export interface ErasureTools {
  readonly scope: ExecutionScope;
  readonly clock: Clock;
  /** Where the documents attached to the appointments of the person live. */
  readonly files: FileStorage;
}

/**
 * Every copy of a person the contexts keep in clear, and how each one is erased, in the order the
 * platform runs them in each network: identity forgets the person (name and address), notification
 * forgets the address it reached them at, scheduling pseudonymises the notes and the cancellation
 * reasons of their appointments, deletes the documents attached to them and the name the
 * practitioner directory copied. What is sealed in the event store is erased by the key, before
 * these steps; what was published to other systems is not reached: see the README.
 */
export function copiesOfAPerson(persistence: Persistence, { scope, clock, files }: ErasureTools): ErasureStep[] {
  const persons = new KnexPersonRepository(persistence.database, scope, clock);
  const contacts = new KnexContacts(persistence.database, scope);
  const patient: PatientErasure = new KnexPatientErasure(persistence.database, scope, files);

  return [
    { name: 'identity.persons', erase: async (personId) => ((await persons.erase(personId)) ? 1 : 0) },
    { name: 'notification.contacts', erase: (personId) => forgetContact(contacts, personId, clock) },
    { name: 'scheduling.patient', erase: (personId) => patient.erase(personId) },
  ];
}

/**
 * Deletes the contact under a stamp of this instant: the row keeps the stamp, so the announcement
 * that created it, delivered again later, does not bring the address back.
 */
async function forgetContact(contacts: KnexContacts, personId: string, clock: Clock): Promise<number> {
  const stamp = storableStamp({ eventId: `erasure:${personId}`, occurredAt: clock.now() });

  return (await contacts.delete(personId, stamp)) === 'applied' ? 1 : 0;
}
