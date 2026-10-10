import { Access } from '@ddd-ts-kit/auth';
import { scoped } from '@ddd-ts-kit/kernel';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import { analyticsPermissions } from '#src/contexts/analytics/application/authorization/analytics.permissions.js';
import { OccupancyReader } from '#src/contexts/analytics/application/ports/occupancy-reader.port.js';
import { SearchOccupancyQuery } from '#src/contexts/analytics/application/queries/search-occupancy/search-occupancy.query.js';
import type { SearchOccupancyResult } from '#src/contexts/analytics/application/queries/search-occupancy/search-occupancy.result.js';

@QueryHandler(SearchOccupancyQuery, [OccupancyReader, Access])
export class SearchOccupancyHandler implements QueryHandler<SearchOccupancyQuery> {
  constructor(
    private readonly occupancy: OccupancyReader,
    private readonly access: Access,
  ) {}

  async execute(query: SearchOccupancyQuery): Promise<SearchOccupancyResult> {
    const scope = await this.access.scope(query.actor, analyticsPermissions['occupancy.read'], 'calendar');
    const ofThePractice = query.criteria.where('practiceId', 'eq', query.practiceId);

    return this.occupancy.search(scoped(ofThePractice, scope, { ids: 'calendarId' }));
  }
}
