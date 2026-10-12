import type { Page } from '@ddd-ts-kit/kernel';
import type { Occupancy } from '@/contexts/analytics/application/ports/occupancy-reader.port';

export type SearchOccupancyResult = Page<Occupancy>;
