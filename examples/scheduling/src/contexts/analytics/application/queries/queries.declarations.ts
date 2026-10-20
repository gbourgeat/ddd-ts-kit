import { injected } from '@ddd-ts-kit/kernel/declarations';
import { OccupancyReader } from '@/contexts/analytics/application/ports/occupancy-reader.port';
import { SearchOccupancyHandler } from '@/contexts/analytics/application/queries/search-occupancy/search-occupancy.handler';
import { Access } from '@ddd-ts-kit/auth';

export * from '@/contexts/analytics/application/queries/search-occupancy/search-occupancy.handler';
export * from '@/contexts/analytics/application/queries/search-occupancy/search-occupancy.query';

injected(SearchOccupancyHandler, [OccupancyReader, Access]);
