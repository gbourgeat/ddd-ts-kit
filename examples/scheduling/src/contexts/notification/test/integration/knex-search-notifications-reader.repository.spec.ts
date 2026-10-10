import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AccessScope } from '@ddd-ts-kit/auth';
import {
  FixedClock,
  FixedExecutionScope,
  cursorPage,
  executionContext,
  offsetPage,
  systemActor,
} from '@ddd-ts-kit/kernel';
import type { SearchNotificationsReader } from '#src/contexts/notification/application/ports/search-notifications-reader.port.js';
import type { Notification } from '#src/contexts/notification/domain/aggregates/notification.aggregate.js';
import { KnexSearchNotificationsReader } from '#src/contexts/notification/infrastructure/persistence/knex-search-notifications-reader.repository.js';
import { KnexNotificationRepository } from '#src/contexts/notification/infrastructure/persistence/knex-notification.repository.js';
import { openTestDatabase, type TestDatabase } from '#src/platform/database/open-test-database.js';
import { aNotification } from '#src/contexts/notification/test/builders/notification.builder.js';
import { FakeSearchNotificationsReader } from '#src/contexts/notification/test/fakes/search-notifications-reader.fake.js';

const everyone: AccessScope = { kind: 'all' };
const startsAt = new Date('2026-02-01T09:00:00.000Z');

let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

describe.each([
  ['FakeSearchNotificationsReader', fakeReader],
  ['KnexSearchNotificationsReader', knexReader],
] as const)('%s', (_name, createReader) => {
  it('lists every notification with what it told, the latest first, the id deciding between two sent at the same instant', async () => {
    const reader = await createReader();

    const page = await reader.search(everyone, offsetPage());

    expect(page.items.map((item) => item.id)).toEqual([
      'notification-4',
      'notification-3',
      'notification-2',
      'notification-1',
    ]);

    expect(page.items[3]).toEqual({
      id: 'notification-1',
      recipientId: 'patient-1',
      kind: 'confirmation',
      appointmentId: 'appointment-1',
      startsAt,
      sentAt: new Date('2026-01-01T08:00:00.000Z'),
    });

    expect(page.total).toBe(4);
  });

  it('narrows the list to the recipients the scope names, total included', async () => {
    const reader = await createReader();

    const page = await reader.search({ kind: 'ids', ids: ['patient-2'] }, offsetPage());

    expect(page.items.map((item) => item.id)).toEqual(['notification-2']);
    expect(page.total).toBe(1);
  });

  it('answers an empty page to a scope that names nobody', async () => {
    const reader = await createReader();

    expect(await reader.search({ kind: 'none' }, offsetPage())).toEqual({ items: [], total: 0 });
    expect(await reader.search({ kind: 'ids', ids: [] }, offsetPage())).toEqual({ items: [], total: 0 });
  });

  it('lists the oldest first when asked, and windows the list by offset', async () => {
    const reader = await createReader();

    const page = await reader.search(
      everyone,
      offsetPage({ offset: 1, limit: 2, sort: [{ field: 'sentAt', direction: 'asc' }] }),
    );

    expect(page.items.map((item) => item.id)).toEqual(['notification-2', 'notification-3']);
    expect(page.total).toBe(4);
  });

  it('resumes after the last notification of a page, without repeating or skipping one sent at the same instant', async () => {
    const reader = await createReader();
    const first = await reader.search({ kind: 'ids', ids: ['patient-1'] }, cursorPage({ limit: 1 }));

    const second = await reader.search(
      { kind: 'ids', ids: ['patient-1'] },
      cursorPage({ limit: 2, ...(first.nextCursor === undefined ? {} : { cursor: first.nextCursor }) }),
    );

    expect(first.items.map((item) => item.id)).toEqual(['notification-4']);
    expect(second.items.map((item) => item.id)).toEqual(['notification-3', 'notification-1']);
    expect(second.nextCursor).toBeUndefined();
  });

  it('refuses a cursor it did not write, with INVALID_PAGE_REQUEST', async () => {
    const reader = await createReader();

    await expect(reader.search(everyone, cursorPage({ cursor: 'not-a-cursor' }))).rejects.toMatchObject({
      code: 'INVALID_PAGE_REQUEST',
    });
  });
});

async function fakeReader(): Promise<SearchNotificationsReader> {
  return new FakeSearchNotificationsReader(
    sentNotifications().map((sent) => ({
      id: sent.id,
      recipientId: sent.recipientId,
      kind: sent.kind.value,
      appointmentId: sent.appointmentId,
      startsAt: sent.startsAt,
      sentAt: sent.registeredAt,
    })),
  );
}

async function knexReader(): Promise<SearchNotificationsReader> {
  await database.reset();

  const scope = new FixedExecutionScope(
    executionContext({ correlationId: 'reader-spec', actor: systemActor('notification.spec'), origin: 'test' }),
  );

  const repository = new KnexNotificationRepository(
    database.persistence.database,
    scope,
    new FixedClock(new Date('2026-01-04T00:00:00.000Z')),
  );

  await repository.save(sentNotifications()[0] ?? aNotification().build());
  await repository.save(sentNotifications()[1] ?? aNotification().build());
  await repository.save(sentNotifications()[2] ?? aNotification().build());
  await repository.save(sentNotifications()[3] ?? aNotification().build());

  return new KnexSearchNotificationsReader(database.persistence.database);
}

/** Three notifications of one patient, two of them sent at the same instant, and one of another patient. */
function sentNotifications(): readonly Notification[] {
  return [
    aNotification()
      .identifiedBy('notification-1')
      .sentTo('patient-1')
      .ofKind('confirmation')
      .about('appointment-1', startsAt)
      .bornAt(new Date('2026-01-01T08:00:00.000Z'))
      .build(),
    aNotification()
      .identifiedBy('notification-2')
      .sentTo('patient-2')
      .ofKind('confirmation')
      .about('appointment-2', startsAt)
      .bornAt(new Date('2026-01-02T08:00:00.000Z'))
      .build(),
    aNotification()
      .identifiedBy('notification-3')
      .sentTo('patient-1')
      .ofKind('reminder')
      .about('appointment-1', startsAt)
      .bornAt(new Date('2026-01-03T08:00:00.000Z'))
      .build(),
    aNotification()
      .identifiedBy('notification-4')
      .sentTo('patient-1')
      .ofKind('cancellation')
      .about('appointment-1', startsAt)
      .bornAt(new Date('2026-01-03T08:00:00.000Z'))
      .build(),
  ];
}
