import { describe, expect, it } from 'vitest';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import { platformTestModule } from '@/platform/composition/platform-test.module';
import { personRegisteredV1 } from '@/contexts/identity/published-language';
import { Contacts } from '@/contexts/notification/application/ports/contacts.port';
import * as notificationDeclarations from '@/contexts/notification/notification.declarations';
import { FakeContacts } from '@/contexts/notification/test/fakes/contacts.fake';

/** The projection alone, taken from the generated file of its context, which also says what its constructor is injected. */
const projections = contextModule('notification', { ContactsProjection: notificationDeclarations.ContactsProjection });

describe('Contacts, known from identity', () => {
  it('knows the contact of a person once identity announced their registration', async () => {
    const { application, contacts } = await arrange();

    await application.eventBus.publish([registered('event-1', 'ada@example.test')]);

    expect(await contacts.get('person-1')).toEqual({ recipientId: 'person-1', address: 'ada@example.test' });
  });

  it('knows nothing of a person identity never announced', async () => {
    const { contacts } = await arrange();

    expect(await contacts.get('person-2')).toBeUndefined();
  });

  it('keeps the same contact when the same event is delivered twice', async () => {
    const { application, contacts } = await arrange();

    await application.eventBus.publish([registered('event-1', 'ada@example.test')]);
    await application.eventBus.publish([registered('event-1', 'ada@example.test')]);

    expect(await contacts.get('person-1')).toEqual({ recipientId: 'person-1', address: 'ada@example.test' });
  });

  it('keeps the latest contact when an older announcement is delivered late', async () => {
    const { application, contacts } = await arrange();

    await application.eventBus.publish([registered('event-2', 'ada@new.example.test', '2026-01-03T08:00:00.000Z')]);
    await application.eventBus.publish([registered('event-1', 'ada@example.test', '2026-01-02T08:00:00.000Z')]);

    expect(await contacts.get('person-1')).toMatchObject({ address: 'ada@new.example.test' });
  });
});

async function arrange() {
  const contacts = new FakeContacts();

  const application = createTestApplication({
    modules: [platformTestModule, projections],
    fakes: [fake(Contacts, contacts)],
  });

  await application.start();

  return { application, contacts };
}

function registered(id: string, email: string, occurredAt = '2026-01-02T08:00:00.000Z') {
  return personRegisteredV1.create(
    { personId: 'person-1', displayName: 'Ada Lovelace', email },
    { id, occurredAt: new Date(occurredAt) },
  );
}
