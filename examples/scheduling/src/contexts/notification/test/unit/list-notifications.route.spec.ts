import { describe, expect, it } from 'vitest';
import { executeRoute } from '@ddd-ts-kit/http';
import { InMemoryQueryBus, type PageRequest } from '@ddd-ts-kit/kernel';
import { ListNotificationsQuery } from '../../application/queries/list-notifications/list-notifications.query.js';
import type { ListNotificationsItem, ListNotificationsSort } from '../../application/queries/list-notifications/list-notifications.result.js';
import { listNotificationsRoute } from '../../presentation/http/list-notifications.route.js';

const sent: ListNotificationsItem = {
  id: 'notification-1',
  recipientId: 'patient-1',
  kind: 'reminder',
  appointmentId: 'appointment-1',
  startsAt: new Date('2026-02-01T09:00:00.000Z'),
  sentAt: new Date('2026-01-31T09:00:00.000Z'),
};

describe('GET /notifications', () => {
  it('answers 200 when the use case succeeds', async () => {
    const { route } = arrange();

    const response = await executeRoute(route, { params: {}, query: {}, headers: {}, body: {}, raw: undefined }, { validateResponses: true });

    expect(response.status).toBe(200);
  });

  it('answers each notification with its kind, its appointment and its instants, and never its recipient', async () => {
    const { route } = arrange();

    const response = await executeRoute(route, { params: {}, query: {}, headers: {}, body: {}, raw: undefined }, { validateResponses: true });

    expect(response.body).toEqual({
      items: [{ id: 'notification-1', kind: 'reminder', appointmentId: 'appointment-1', startsAt: '2026-02-01T09:00:00.000Z', sentAt: '2026-01-31T09:00:00.000Z' }],
      total: 1,
    });
  });

  it('hands the page and the sort the client asked for to the use case', async () => {
    const { route, asked } = arrange();

    await executeRoute(route, { params: {}, query: { limit: '5', offset: '10', sort: '-sentAt' }, headers: {}, body: {}, raw: undefined }, { validateResponses: true });

    expect(asked).toMatchObject([{ kind: 'offset', limit: 5, offset: 10, sort: [{ field: 'sentAt', direction: 'desc' }] }]);
  });

  it('refuses a sort on a field the list does not offer, and a page above 100, with 422', async () => {
    const { route } = arrange();

    const unsortable = await executeRoute(route, { params: {}, query: { sort: 'kind' }, headers: {}, body: {}, raw: undefined }, { validateResponses: true });
    const tooLarge = await executeRoute(route, { params: {}, query: { limit: '101' }, headers: {}, body: {}, raw: undefined }, { validateResponses: true });

    expect(unsortable.status).toBe(422);
    expect(tooLarge.status).toBe(422);
  });
});

function arrange() {
  const asked: PageRequest<ListNotificationsSort>[] = [];

  const queries = new InMemoryQueryBus().register(ListNotificationsQuery, {
    execute: async (query: ListNotificationsQuery) => {
      asked.push(query.page);

      return { items: [sent], total: 1 };
    },
  });

  return { route: listNotificationsRoute(queries), asked };
}
