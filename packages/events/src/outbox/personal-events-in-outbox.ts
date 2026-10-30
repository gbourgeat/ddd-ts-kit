import type { PersonalDataCopy } from '@ddd-ts-kit/kernel';
import type { OutboxStore } from './outbox-store';
import type { PersonalEvent } from './personal-event';

/**
 * The outbox as one more copy of a person, for `shared` of `eraseDataSubject`: its records outlive
 * the rows they came from until the purge of what was published, and those of a dead event for good.
 * The table is not confined to a tenant, so it is erased once, not once per tenant.
 */
export function personalEventsInOutbox(store: OutboxStore, events: readonly PersonalEvent[]): PersonalDataCopy {
  return { name: 'platform.outbox', erase: (subject) => store.erasePersonalFields(subject, events) };
}
