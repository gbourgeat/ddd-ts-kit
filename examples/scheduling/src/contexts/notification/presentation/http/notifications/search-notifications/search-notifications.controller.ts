import {
  Controller,
  pageQuerySchema,
  pageResponse,
  pageSchemaOf,
  type HttpRequest,
  type PageBody,
} from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { SearchNotificationsQuery } from '@/contexts/notification/application/queries/search-notifications/search-notifications.query';
import type { SearchNotificationsItem } from '@/contexts/notification/application/queries/search-notifications/search-notifications.result';
import { SearchNotificationsLine } from '@/contexts/notification/presentation/http/notifications/search-notifications/search-notifications.line';
import type { Infer } from '@ddd-ts-kit/validation';
import { NotificationsRoutes } from '@/contexts/notification/presentation/http/notifications.routes';

const query = pageQuerySchema({ sortable: ['sentAt'], maxSize: 100 });

const line = classSchema(SearchNotificationsLine);

@Controller({
  group: NotificationsRoutes,
  method: 'GET',
  path: '/',
  summary: 'Search notifications',
  query,
  response: { status: 200, description: 'One page of the search.', body: pageSchemaOf(line) },
  errors: [],
})
export class SearchNotificationsController {
  constructor(private readonly queries: QueryBus) {}

  async handle(request: HttpRequest<{ query: Infer<typeof query> }>): Promise<PageBody<SearchNotificationsLine>> {
    const page = await this.queries.execute(new SearchNotificationsQuery(request.actor, request.query));

    return pageResponse(page, toLine);
  }
}

function toLine(notification: SearchNotificationsItem): SearchNotificationsLine {
  return {
    id: notification.id,
    kind: notification.kind,
    appointmentId: notification.appointmentId,
    startsAt: notification.startsAt.toISOString(),
    sentAt: notification.sentAt.toISOString(),
  };
}
