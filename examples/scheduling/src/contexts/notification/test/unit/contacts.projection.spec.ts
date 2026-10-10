import { describe, expect, it } from 'vitest';
import { createTestApplication, defineContextModule, fake } from '@ddd-ts-kit/di';
import { platformTestModule } from '@/platform/platform-test.module.js';
import { personRegisteredV1 } from '@/contexts/identity/published-language/index.js';
import { Contacts } from '@/contexts/notification/application/ports/contacts.port.js';
import { ContactsProjection } from '@/contexts/notification/application/projections/contacts.projection.js';
import { FakeContacts } from '@/contexts/notification/test/fakes/contacts.fake.js';

/** The generated barrel does not take a projection yet: it joins the context here as it does in the platform. */
const projections = defineContextModule({
  name: 'notification',
  register(builder) {
    builder.include(ContactsProjection);
  },
});

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
