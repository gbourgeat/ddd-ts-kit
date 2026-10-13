import type { Knex } from 'knex';
import type { AccessScope } from '@ddd-ts-kit/auth';
import {
  InvalidPageRequestError,
  decodeCursor,
  encodeCursor,
  pageOf,
  type CursorPageRequest,
  type ExecutionScope,
  type OffsetPageRequest,
  type PageRequest,
  type SortDirection,
} from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, tenantTable } from '@ddd-ts-kit/knex';
import { SearchNotificationsReader } from '@/contexts/notification/application/ports/search-notifications-reader.port';
import type {
  SearchNotificationsItem,
  SearchNotificationsResult,
  SearchNotificationsSort,
} from '@/contexts/notification/application/queries/search-notifications/search-notifications.result';
import { NOTIFICATION_SCHEMA } from '@/contexts/notification/infrastructure/persistence/notification.schema';
import type { NotificationRow } from '@/contexts/notification/infrastructure/persistence/notification-row.schema';

/** The notifications of the network of the work, before any narrowing by recipient. */
const NOTIFICATIONS = { schema: NOTIFICATION_SCHEMA, table: 'notifications' };

interface Position {
  readonly sentAt: Date;
  readonly id: string;
}

@Repository(SearchNotificationsReader)
export class KnexSearchNotificationsReader implements SearchNotificationsReader {
  constructor(
    private readonly database: KnexContext,
    private readonly execution: ExecutionScope,
  ) {}

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
    const rows = await inOrder(visibleTo(notificationsOf(this.database, this.execution), scope), directionOf(page))
      .limit(page.limit)
      .offset(page.offset);

    const counted = await visibleTo(notificationsOf(this.database, this.execution), scope)
      .count<{ total: string | number }[]>({ total: '*' })
      .first();

    return pageOf(rows.map(toItem), { total: Number(counted?.total ?? 0) });
  }

  private async byCursor(
    scope: AccessScope,
    page: CursorPageRequest<SearchNotificationsSort>,
  ): Promise<SearchNotificationsResult> {
    const direction = directionOf(page);
    const ordered = inOrder(visibleTo(notificationsOf(this.database, this.execution), scope), direction);

    const rows = await (page.cursor === undefined
      ? ordered
      : beyond(ordered, positionOf(page.cursor), direction)
    ).limit(page.limit + 1);

    const notifications = rows.slice(0, page.limit).map(toItem);
    const last = notifications.at(-1);
    const more = rows.length > page.limit && last !== undefined;

    return pageOf(
      notifications,
      more ? { nextCursor: encodeCursor({ sentAt: last.sentAt.toISOString(), id: last.id }) } : {},
    );
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

/** A function and not a method: a query builder is thenable, and a method that answers one is read as asynchronous by whatever wraps the adapter (tracing), which then answers a promise. */
function notificationsOf(database: KnexContext, execution: ExecutionScope): Notifications {
  return tenantTable<NotificationRow>(database, execution, NOTIFICATIONS);
}

/** The notifications of the recipients the scope names: the restriction is part of the statement, never applied after loading. */
function visibleTo(notifications: Notifications, scope: AccessScope): Notifications {
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
