import { AuthorizedQuery, type Actor, type Criteria } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { analyticsPermissions } from '../../authorization/analytics.permissions.js';
import type { Occupancy } from '../../ports/occupancy-reader.port.js';
import type { ListOccupancyResult } from './list-occupancy.result.js';

@Requires(analyticsPermissions['occupancy.read'], {
  resource: (query: ListOccupancyQuery) => ({ type: 'practice', id: query.practiceId }),
})
export class ListOccupancyQuery extends AuthorizedQuery<ListOccupancyResult> {
  /** `criteria`: the calendars, the days, the order and the page asked for, as the read of the occupancy accepts them. */
  constructor(
    actor: Actor,
    readonly practiceId: string,
    readonly criteria: Criteria<Occupancy>,
  ) {
    super(actor);
  }
}
