import { Access } from '@ddd-ts-kit/auth';
import { scoped } from '@ddd-ts-kit/kernel';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import { analyticsPermissions } from '../../authorization/analytics.permissions.js';
import { OccupancyRegister } from '../../ports/occupancy-register.port.js';
import { ListOccupancyQuery } from './list-occupancy.query.js';
import type { ListOccupancyResult } from './list-occupancy.result.js';

@QueryHandler(ListOccupancyQuery, [OccupancyRegister, Access])
export class ListOccupancyHandler implements QueryHandler<ListOccupancyQuery> {
  constructor(
    private readonly occupancy: OccupancyRegister,
    private readonly access: Access,
  ) {}

  async execute(query: ListOccupancyQuery): Promise<ListOccupancyResult> {
    const scope = await this.access.scope(query.actor, analyticsPermissions['occupancy.read'], 'calendar');
    const ofThePractice = query.criteria.where('practiceId', 'eq', query.practiceId);

    return this.occupancy.list(scoped(ofThePractice, scope, { ids: 'calendarId' }));
  }
}
