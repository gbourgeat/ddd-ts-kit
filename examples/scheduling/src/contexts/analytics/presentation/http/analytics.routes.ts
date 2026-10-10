import type { Route } from '@ddd-ts-kit/http';
import type { CommandBus, QueryBus } from '@ddd-ts-kit/kernel';
// ddd-ts-kit:imports
import { listOccupancyRoute } from './list-occupancy.route.js';
// /ddd-ts-kit:imports

export function analyticsRoutes(commands: CommandBus, queries: QueryBus): readonly Route[] {
  return [
    // ddd-ts-kit:routes
    listOccupancyRoute(queries),
    // /ddd-ts-kit:routes
  ];
}
