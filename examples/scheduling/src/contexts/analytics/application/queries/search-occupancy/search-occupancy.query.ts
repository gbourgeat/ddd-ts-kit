import { AuthorizedQuery, type Actor, type Criteria } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { analyticsPermissions } from '@/contexts/analytics/application/authorization/analytics.permissions';
import type { Occupancy } from '@/contexts/analytics/application/ports/occupancy-reader.port';
import type { SearchOccupancyResult } from '@/contexts/analytics/application/queries/search-occupancy/search-occupancy.result';

@Requires(analyticsPermissions['occupancy.read'], {
  resource: (query: SearchOccupancyQuery) => ({ type: 'practice', id: query.practiceId }),
})
export class SearchOccupancyQuery extends AuthorizedQuery<SearchOccupancyResult> {
  /** `criteria`: the calendars, the days, the order and the page asked for, as the read of the occupancy accepts them. */
  constructor(
    actor: Actor,
    readonly practiceId: string,
    readonly criteria: Criteria<Occupancy>,
  ) {
    super(actor);
  }
}
