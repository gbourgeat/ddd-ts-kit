import { Access } from '@ddd-ts-kit/auth';
import { scoped } from '@ddd-ts-kit/kernel';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import { analyticsPermissions } from '@/contexts/analytics/application/authorization/analytics.permissions';
import type { OccupancyReader } from '@/contexts/analytics/application/ports/occupancy-reader.port';
import { SearchOccupancyQuery } from '@/contexts/analytics/application/queries/search-occupancy/search-occupancy.query';
import type { SearchOccupancyResult } from '@/contexts/analytics/application/queries/search-occupancy/search-occupancy.result';

@QueryHandler(SearchOccupancyQuery)
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
