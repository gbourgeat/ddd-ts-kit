import type { Route } from '@ddd-ts-kit/http';
import type { CommandBus, QueryBus } from '@ddd-ts-kit/kernel';
// ddd-ts-kit:imports
import { searchOccupancyRoute } from '@/contexts/analytics/presentation/http/search-occupancy.route';
// /ddd-ts-kit:imports

export function analyticsRoutes(commands: CommandBus, queries: QueryBus): readonly Route[] {
  return [
    // ddd-ts-kit:routes
    searchOccupancyRoute(queries),
    // /ddd-ts-kit:routes
  ];
}
