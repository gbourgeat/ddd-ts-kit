import type { Knex } from 'knex';
import type { AccessScope } from '@ddd-ts-kit/auth';
import {
  InvalidPageRequestError,
  decodeCursor,
  encodeCursor,
  pageOf,
  type CursorPageRequest,
  type OffsetPageRequest,
  type PageRequest,
  type SortDirection,
} from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext } from '@ddd-ts-kit/knex';
import { SearchNotificationsReader } from '@/contexts/notification/application/ports/search-notifications-reader.port';
import type {
  SearchNotificationsItem,
  SearchNotificationsResult,
  SearchNotificationsSort,
} from '@/contexts/notification/application/queries/search-notifications/search-notifications.result';
import { NOTIFICATION_SCHEMA } from '@/contexts/notification/infrastructure/persistence/notification.schema';
import type { NotificationRow } from '@/contexts/notification/infrastructure/persistence/notification-row.schema';

interface Position {
  readonly sentAt: Date;
  readonly id: string;
}

@Repository(SearchNotificationsReader)
export class KnexSearchNotificationsReader implements SearchNotificationsReader {
  constructor(private readonly database: KnexContext) {}

  async search(scope: AccessScope, page: PageRequest<SearchNotificationsSort>): Promise<SearchNotificationsResult> {
    if (scope.kind === 'none' || (scope.kind === 'ids' && scope.ids.length === 0)) {
      return pageOf([], page.kind === 'offset' ? { total: 0 } : {});
    }

    return page.kind === 'offset' ? this.byOffset(scope, page) : this.byCursor(scope, page);
  }

  private async byOffset(
    scope: AccessScope,
    page: OffsetPageRequest<SearchNotificationsSort>,
  ): Promise<SearchNotificationsResult> {
    const rows = await inOrder(visibleTo(this.database, scope), directionOf(page))
      .limit(page.limit)
      .offset(page.offset);

    const counted = await visibleTo(this.database, scope).count<{ total: string | number }[]>({ total: '*' }).first();

    return pageOf(rows.map(toItem), { total: Number(counted?.total ?? 0) });
  }

  private async byCursor(
    scope: AccessScope,
    page: CursorPageRequest<SearchNotificationsSort>,
  ): Promise<SearchNotificationsResult> {
    const direction = directionOf(page);
    const ordered = inOrder(visibleTo(this.database, scope), direction);

    const rows = await (page.cursor === undefined
      ? ordered
      : beyond(ordered, positionOf(page.cursor), direction)
    ).limit(page.limit + 1);

    const items = rows.slice(0, page.limit).map(toItem);
    const last = items.at(-1);
    const more = rows.length > page.limit && last !== undefined;

    return pageOf(items, more ? { nextCursor: encodeCursor({ sentAt: last.sentAt.toISOString(), id: last.id }) } : {});
  }
}

type Notifications = Knex.QueryBuilder<NotificationRow, NotificationRow[]>;

/** Latest first unless the page says otherwise. */
function directionOf(page: PageRequest<SearchNotificationsSort>): SortDirection {
  return page.sort[0]?.direction ?? 'desc';
}

/** The id follows the instant, in the same direction: the order is total, so a cursor resumes where the page ended. */
function inOrder(notifications: Notifications, direction: SortDirection): Notifications {
  return notifications.orderBy([
    { column: 'registered_at', order: direction },
    { column: 'id', order: direction },
  ]);
}

/** The notifications of the recipients the scope names: the restriction is part of the statement, never applied after loading. */
function visibleTo(database: KnexContext, scope: AccessScope): Notifications {
  const notifications = database
    .executor()<NotificationRow, NotificationRow[]>('notifications')
    .withSchema(NOTIFICATION_SCHEMA);

  if (scope.kind === 'ids') {
    return notifications.whereIn('recipient_id', [...scope.ids]);
  }

  if (scope.kind === 'filter') {
    throw new Error('The notifications of a person are narrowed by recipients: a scope by attributes is not mapped.');
  }

  return notifications;
}

/** The rows after a position, as a tuple comparison: the id decides among notifications sent at the same instant. */
function beyond(query: Notifications, position: Position, direction: SortDirection): Notifications {
  const past = direction === 'asc' ? '>' : '<';

  return query.where((after) => {
    void after.where('registered_at', past, position.sentAt).orWhere((tied) => {
      void tied.where('registered_at', position.sentAt).where('id', past, position.id);
    });
  });
}

function positionOf(cursor: string): Position {
  const { sentAt, id } = decodeCursor(cursor);
  const instant = typeof sentAt === 'string' ? new Date(sentAt) : undefined;

  if (instant === undefined || Number.isNaN(instant.getTime()) || typeof id !== 'string') {
    throw new InvalidPageRequestError('The cursor of a page is the nextCursor of a previous page');
  }

  return { sentAt: instant, id };
}

function toItem(row: NotificationRow): SearchNotificationsItem {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    kind: row.kind,
    appointmentId: row.appointment_id,
    startsAt: row.starts_at,
    sentAt: row.registered_at,
  };
}
