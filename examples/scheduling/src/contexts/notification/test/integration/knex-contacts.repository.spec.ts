import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Criteria, scoped } from '@ddd-ts-kit/kernel';
import type { Contact, Contacts } from '../../application/ports/contacts.port.js';
import { KnexContacts } from '../../infrastructure/persistence/knex-contacts.repository.js';
import { storableStamp } from '../../../../shared-kernel/storable-stamp.js';
import { openTestDatabase, type TestDatabase } from '../../../../platform/database/open-test-database.js';
import { FakeContacts } from '../fakes/contacts.fake.js';

const first = { eventId: 'event-1', occurredAt: new Date('2026-01-02T08:00:00.000Z') };
const second = { eventId: 'event-2', occurredAt: new Date('2026-01-03T08:00:00.000Z') };
const ada: Contact = { recipientId: 'person-1', address: 'ada@example.test' };

let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

beforeEach(async () => {
  await database.reset();
});

describe.each([
  ['FakeContacts', (): Contacts => new FakeContacts()],
  ['KnexContacts', (): Contacts => new KnexContacts(database.persistence.database)],
] as const)('%s', (_name, createContacts) => {
  it('answers the contact of a recipient as it was last announced', async () => {
    const contacts = createContacts();

    await contacts.upsertIfNewer('person-1', first, () => ada);

    await contacts.upsertIfNewer('person-1', second, (known) => ({
      recipientId: 'person-1',
      address: 'new-' + (known?.address ?? ''),
    }));

    expect(await contacts.get('person-1')).toEqual({ recipientId: 'person-1', address: 'new-ada@example.test' });
    expect(await contacts.get('person-2')).toBeUndefined();
  });

  it('ignores an announcement older than the one it holds, and the same one delivered again', async () => {
    const contacts = createContacts();

    await contacts.upsertIfNewer('person-1', second, () => ada);
    const late = await contacts.upsertIfNewer('person-1', first, () => ({ ...ada, address: 'old@example.test' }));
    const again = await contacts.upsertIfNewer('person-1', second, () => ({ ...ada, address: 'again@example.test' }));

    expect([late, again]).toEqual(['stale', 'stale']);
    expect(await contacts.get('person-1')).toEqual(ada);
  });

  it('lists the contacts by recipient', async () => {
    const contacts = createContacts();

    await contacts.upsertIfNewer('person-2', first, () => ({ recipientId: 'person-2', address: 'grace@example.test' }));
    await contacts.upsertIfNewer('person-1', first, () => ada);

    const page = await contacts.search(scoped(Criteria.of<Contact>(), { kind: 'all' }, { ids: 'recipientId' }));

    expect(page.items.map((contact) => contact.recipientId)).toEqual(['person-1', 'person-2']);
  });

  // The stamps of real facts carry milliseconds, which the SQL store reads back to the second: the projections stamp with `storableStamp`.
  it('follows the announcements of a recipient milliseconds apart, as the projection stamps them', async () => {
    const contacts = createContacts();

    const writes = [
      await contacts.upsertIfNewer('person-1', storableStamp(precise('event-1', 123)), () => ada),
      await contacts.upsertIfNewer('person-1', storableStamp(precise('event-2', 456)), () => ({
        ...ada,
        address: 'new@example.test',
      })),
      await contacts.upsertIfNewer('person-1', storableStamp(precise('event-1', 123)), () => ada),
    ];

    expect(writes).toEqual(['applied', 'applied', 'stale']);
    expect(await contacts.get('person-1')).toEqual({ ...ada, address: 'new@example.test' });
  });
});

function precise(eventId: string, millisecond: number) {
  return { eventId, occurredAt: new Date(Date.UTC(2026, 0, 2, 8, 0, 0, millisecond)) };
}
