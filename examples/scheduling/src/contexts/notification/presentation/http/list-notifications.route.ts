import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, pageQuerySchema, pageResponse, pageSchemaOf, type Route } from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { ListNotificationsQuery } from '../../application/queries/list-notifications/list-notifications.query.js';
import type { ListNotificationsItem } from '../../application/queries/list-notifications/list-notifications.result.js';
import { ListNotificationsLine } from './list-notifications-line.dto.js';

const query = pageQuerySchema({ sortable: ['sentAt'], maxSize: 100 });

const line = classSchema(ListNotificationsLine);

export function listNotificationsRoute(queries: QueryBus): Route {
  return defineRoute(
    {
      method: 'GET',
      path: '/notifications',
      operationId: 'listNotifications',
      summary: 'List notifications',
      tags: ['notification'],
      request: { query },
      responses: { 200: { description: 'One page of the list.', body: pageSchemaOf(line) } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN'],
      security: ['bearer'],
    },
    async (input) => {
      const page = await queries.execute(new ListNotificationsQuery(actorOf(input.context.principal), input.query));

      return { status: 200, body: pageResponse(page, toLine) };
    },
  );
}

function toLine(item: ListNotificationsItem): ListNotificationsLine {
  return {
    id: item.id,
    kind: item.kind,
    appointmentId: item.appointmentId,
    startsAt: item.startsAt.toISOString(),
    sentAt: item.sentAt.toISOString(),
  };
}
