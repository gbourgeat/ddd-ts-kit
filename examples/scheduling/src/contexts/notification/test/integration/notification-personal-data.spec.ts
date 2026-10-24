import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { anExecutionContext } from '@ddd-ts-kit/testing';
import { FixedClock, FixedExecutionScope, NotADataSubjectIdError } from '@ddd-ts-kit/kernel';
import type { Contact } from '@/contexts/notification/application/ports/contacts.port';
import { KnexContacts } from '@/contexts/notification/infrastructure/persistence/knex-contacts.repository';
import { KnexNotificationPersonalDataErasure } from '@/contexts/notification/infrastructure/persistence/knex-notification-personal-data-erasure.repository';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';

const north = new FixedExecutionScope(anExecutionContext().ofTenant('north').build());
const south = new FixedExecutionScope(anExecutionContext().ofTenant('south').build());
const clock = new FixedClock(new Date('2026-02-01T09:00:00.000Z'));

/** The announcement that made the contact known, before the erasure. */
const registered = { eventId: 'person-registered-1', occurredAt: new Date('2026-01-02T08:00:00.000Z') };
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

describe('KnexNotificationPersonalDataErasure, the right to erasure', () => {
  it('forgets the address of the person, and reaches nothing the second time', async () => {
    const contacts = new KnexContacts(database.persistence.database, north);
    const erasure = new KnexNotificationPersonalDataErasure(database.persistence.database, north, clock);

    await contacts.upsertIfNewer('person-1', registered, () => ada);

    expect(await erasure.erase('person-1')).toBe(1);
    expect(await contacts.get('person-1')).toBeUndefined();
    expect(await erasure.erase('person-1')).toBe(0);
  });

  it('keeps the address away when the announcement that made it known is delivered again', async () => {
    const contacts = new KnexContacts(database.persistence.database, north);

    await contacts.upsertIfNewer('person-1', registered, () => ada);
    await new KnexNotificationPersonalDataErasure(database.persistence.database, north, clock).erase('person-1');
    await contacts.upsertIfNewer('person-1', registered, () => ada);

    expect(await contacts.get('person-1')).toBeUndefined();
  });

  it('forgets a contact of its own network alone', async () => {
    await new KnexContacts(database.persistence.database, north).upsertIfNewer('person-1', registered, () => ada);

    expect(
      await new KnexNotificationPersonalDataErasure(database.persistence.database, south, clock).erase('person-1'),
    ).toBe(0);

    expect(await new KnexContacts(database.persistence.database, north).get('person-1')).toEqual(ada);
  });

  it('refuses a subject that is not an opaque identifier, before any statement', async () => {
    const erasure = new KnexNotificationPersonalDataErasure(database.persistence.database, north, clock);

    await expect(erasure.erase('ada@example.test')).rejects.toBeInstanceOf(NotADataSubjectIdError);
    expect(erasure.name).toBe('notification');
  });
});
