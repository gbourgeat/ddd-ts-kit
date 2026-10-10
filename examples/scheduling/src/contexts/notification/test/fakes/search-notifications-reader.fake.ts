import type { AccessScope } from '@ddd-ts-kit/auth';
import { InvalidPageRequestError, decodeCursor, encodeCursor, pageOf, type PageRequest } from '@ddd-ts-kit/kernel';
import type { SearchNotificationsReader } from '@/contexts/notification/application/ports/search-notifications-reader.port.js';
import type {
  SearchNotificationsItem,
  SearchNotificationsResult,
  SearchNotificationsSort,
} from '@/contexts/notification/application/queries/search-notifications/search-notifications.result.js';

/** The read port in memory, over the lines a spec gives it: narrowed by the scope and ordered as the adapter over the database does. */
export class FakeSearchNotificationsReader implements SearchNotificationsReader {
  constructor(private readonly items: readonly SearchNotificationsItem[]) {}

  async search(scope: AccessScope, page: PageRequest<SearchNotificationsSort>): Promise<SearchNotificationsResult> {
    const visible = this.items.filter((item) => isVisible(item, scope)).sort(inOrder(page));
    const start = page.kind === 'offset' ? page.offset : positionAfter(visible, page.cursor);
    const items = visible.slice(start, start + page.limit);

    if (page.kind === 'offset') {
      return pageOf(items, { total: visible.length });
    }

    const last = items.at(-1);

    return pageOf(
      items,
      last !== undefined && start + page.limit < visible.length ? { nextCursor: encodeCursor({ id: last.id }) } : {},
    );
  }
}

function isVisible(item: SearchNotificationsItem, scope: AccessScope): boolean {
  switch (scope.kind) {
    case 'all':
      return true;
    case 'none':
      return false;
    case 'ids':
      return scope.ids.includes(item.recipientId);
    case 'filter':
      return Object.entries(scope.filter).every(([field, value]) => Reflect.get(item, field) === value);
  }
}

function inOrder(
  page: PageRequest<SearchNotificationsSort>,
): (left: SearchNotificationsItem, right: SearchNotificationsItem) => number {
  const toward = page.sort[0]?.direction === 'asc' ? 1 : -1;

  return (left, right) => toward * (left.sentAt.getTime() - right.sentAt.getTime() || left.id.localeCompare(right.id));
}

function positionAfter(visible: readonly SearchNotificationsItem[], cursor: string | undefined): number {
  if (cursor === undefined) {
    return 0;
  }

  const { id } = decodeCursor(cursor);

  if (typeof id !== 'string') {
    throw new InvalidPageRequestError('The cursor of a page is the nextCursor of a previous page');
  }

  return visible.findIndex((item) => item.id === id) + 1;
}
