import { injected } from '@ddd-ts-kit/kernel/declarations';
import { SearchOccupancyController } from '@/contexts/analytics/presentation/http/practices/search-occupancy/search-occupancy.controller';
import { QueryBus } from '@ddd-ts-kit/kernel';

export * from '@/contexts/analytics/presentation/http/practices/search-occupancy/search-occupancy.controller';

injected(SearchOccupancyController, [QueryBus]);
