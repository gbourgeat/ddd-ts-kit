import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, pageQuerySchema, pageResponse, pageSchemaOf, type Route } from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { SearchNotificationsQuery } from '../../application/queries/search-notifications/search-notifications.query.js';
import type { SearchNotificationsItem } from '../../application/queries/search-notifications/search-notifications.result.js';
import { SearchNotificationsLine } from './search-notifications-line.dto.js';

const query = pageQuerySchema({ sortable: ['sentAt'], maxSize: 100 });

const line = classSchema(SearchNotificationsLine);

export function searchNotificationsRoute(queries: QueryBus): Route {
  return defineRoute(
    {
      method: 'GET',
      path: '/notifications',
      operationId: 'searchNotifications',
      summary: 'Search notifications',
      tags: ['notification'],
      request: { query },
      responses: { 200: { description: 'One page of the search.', body: pageSchemaOf(line) } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN'],
      security: ['bearer'],
    },
    async (input) => {
      const page = await queries.execute(new SearchNotificationsQuery(actorOf(input.context.principal), input.query));

      return { status: 200, body: pageResponse(page, toLine) };
    },
  );
}

function toLine(item: SearchNotificationsItem): SearchNotificationsLine {
  return {
    id: item.id,
    kind: item.kind,
    appointmentId: item.appointmentId,
    startsAt: item.startsAt.toISOString(),
    sentAt: item.sentAt.toISOString(),
  };
}
