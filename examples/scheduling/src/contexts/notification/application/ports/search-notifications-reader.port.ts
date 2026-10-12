import type { AccessScope } from '@ddd-ts-kit/auth';
import type { PageRequest } from '@ddd-ts-kit/kernel';
import type {
  SearchNotificationsResult,
  SearchNotificationsSort,
} from '@/contexts/notification/application/queries/search-notifications/search-notifications.result';

export abstract class SearchNotificationsReader {
  /** One page of the notifications sent to the recipients the scope names (its ids are persons), ordered by the instant they were sent then by id. */
  abstract search(scope: AccessScope, page: PageRequest<SearchNotificationsSort>): Promise<SearchNotificationsResult>;
}
