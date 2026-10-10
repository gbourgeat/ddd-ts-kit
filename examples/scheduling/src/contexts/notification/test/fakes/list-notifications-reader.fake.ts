import type { AccessScope } from '@ddd-ts-kit/auth';
import { InvalidPageRequestError, decodeCursor, encodeCursor, pageOf, type PageRequest } from '@ddd-ts-kit/kernel';
import type { ListNotificationsReader } from '../../application/ports/list-notifications-reader.port.js';
import type {
  ListNotificationsItem,
  ListNotificationsResult,
  ListNotificationsSort,
} from '../../application/queries/list-notifications/list-notifications.result.js';

/** The read port in memory, over the lines a spec gives it: narrowed by the scope and ordered as the adapter over the database does. */
export class FakeListNotificationsReader implements ListNotificationsReader {
  constructor(private readonly items: readonly ListNotificationsItem[]) {}

  async list(scope: AccessScope, page: PageRequest<ListNotificationsSort>): Promise<ListNotificationsResult> {
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

function isVisible(item: ListNotificationsItem, scope: AccessScope): boolean {
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
  page: PageRequest<ListNotificationsSort>,
): (left: ListNotificationsItem, right: ListNotificationsItem) => number {
  const toward = page.sort[0]?.direction === 'asc' ? 1 : -1;

  return (left, right) => toward * (left.sentAt.getTime() - right.sentAt.getTime() || left.id.localeCompare(right.id));
}

function positionAfter(visible: readonly ListNotificationsItem[], cursor: string | undefined): number {
  if (cursor === undefined) {
    return 0;
  }

  const { id } = decodeCursor(cursor);

  if (typeof id !== 'string') {
    throw new InvalidPageRequestError('The cursor of a page is the nextCursor of a previous page');
  }

  return visible.findIndex((item) => item.id === id) + 1;
}
