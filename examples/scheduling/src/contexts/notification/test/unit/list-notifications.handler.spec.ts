import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer, type AccessScope, type Authorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as notificationDeclarations from '../../notification.declarations.js';
import { cursorPage, offsetPage } from '@ddd-ts-kit/kernel';
import { platformTestModule } from '../../../../platform/platform-test.module.js';
import { notificationPermissions } from '../../application/authorization/notification.permissions.js';
import { ListNotificationsReader } from '../../application/ports/list-notifications-reader.port.js';
import { ListNotificationsQuery } from '../../application/queries/list-notifications/list-notifications.query.js';
import type { ListNotificationsItem } from '../../application/queries/list-notifications/list-notifications.result.js';
import { FakeListNotificationsReader } from '../fakes/list-notifications-reader.fake.js';

const roles = new RoleBasedAuthorizer({ roles: { holder: [notificationPermissions['notification.read']] } });
const holder = anActor().withRole('holder').build();

const LINES: readonly ListNotificationsItem[] = [
  line('notification-1', 'patient-1', '2026-01-01T08:00:00.000Z'),
  line('notification-2', 'patient-2', '2026-01-02T08:00:00.000Z'),
  line('notification-3', 'patient-1', '2026-01-03T08:00:00.000Z'),
];

/** Roles say who may list; the relationships say whose notifications: here every actor is the person of their own id, as in the application. */
const themselves: Authorizer = {
  check: (request) => roles.check(request),
  listAccessible: async (request): Promise<AccessScope> => ({ kind: 'ids', ids: [request.actor.id] }),
};

describe('List notifications', () => {
  it('answers one page of what the actor may see, with the total, latest first', async () => {
    const application = arrange(LINES);

    const page = await application.queryBus.execute(new ListNotificationsQuery(holder, offsetPage({ limit: 2 })));

    expect(page).toEqual({ items: [LINES[2], LINES[1]], total: 3 });
  });

  it('is refused to an actor who does not hold the permission notification.read', async () => {
    const application = arrange(LINES);

    await expect(application.queryBus.execute(new ListNotificationsQuery(anActor().build(), offsetPage()))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('shows a person the notifications sent to themselves, and no one else\'s', async () => {
    const application = arrange(LINES, themselves);
    const patient = anActor().named('patient-1').withRole('holder').build();

    const page = await application.queryBus.execute(new ListNotificationsQuery(patient, offsetPage()));

    expect(page.items.map((item) => item.id)).toEqual(['notification-3', 'notification-1']);
    expect(page.total).toBe(2);
  });

  it('shows nothing to a person nothing was sent to', async () => {
    const application = arrange(LINES, themselves);
    const newcomer = anActor().named('patient-9').withRole('holder').build();

    const page = await application.queryBus.execute(new ListNotificationsQuery(newcomer, offsetPage()));

    expect(page).toEqual({ items: [], total: 0 });
  });

  it('lists the oldest first when the client asks for it', async () => {
    const application = arrange(LINES);

    const page = await application.queryBus.execute(new ListNotificationsQuery(holder, offsetPage({ sort: [{ field: 'sentAt', direction: 'asc' }] })));

    expect(page.items.map((item) => item.id)).toEqual(['notification-1', 'notification-2', 'notification-3']);
  });

  it('resumes after the last notification of the previous page', async () => {
    const application = arrange(LINES);
    const first = await application.queryBus.execute(new ListNotificationsQuery(holder, cursorPage({ limit: 2 })));

    const second = await application.queryBus.execute(new ListNotificationsQuery(holder, cursorPage({ limit: 2, ...(first.nextCursor === undefined ? {} : { cursor: first.nextCursor }) })));

    expect(first.items.map((item) => item.id)).toEqual(['notification-3', 'notification-2']);
    expect(second.items.map((item) => item.id)).toEqual(['notification-1']);
    expect(second.nextCursor).toBeUndefined();
  });
});

function arrange(lines: readonly ListNotificationsItem[], authorizer: Authorizer = roles) {
  return createTestApplication({
    modules: [platformTestModule, contextModule('notification', notificationDeclarations), authorizationModule({ authorizer })],
    fakes: [fake(ListNotificationsReader, new FakeListNotificationsReader(lines))],
  });
}

function line(id: string, recipientId: string, sentAt: string): ListNotificationsItem {
  return { id, recipientId, kind: 'confirmation', appointmentId: 'appointment-' + id, startsAt: new Date('2026-02-01T09:00:00.000Z'), sentAt: new Date(sentAt) };
}
