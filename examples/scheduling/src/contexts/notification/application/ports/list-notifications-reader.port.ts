import type { AccessScope } from '@ddd-ts-kit/auth';
import type { PageRequest } from '@ddd-ts-kit/kernel';
import type {
  ListNotificationsResult,
  ListNotificationsSort,
} from '../queries/list-notifications/list-notifications.result.js';

export abstract class ListNotificationsReader {
  /** One page of the notifications sent to the recipients the scope names (its ids are persons), ordered by the instant they were sent then by id. */
  abstract list(scope: AccessScope, page: PageRequest<ListNotificationsSort>): Promise<ListNotificationsResult>;
}
