import type { Page } from '@ddd-ts-kit/kernel';
import type { Occupancy } from '#src/contexts/analytics/application/ports/occupancy-reader.port.js';

export type SearchOccupancyResult = Page<Occupancy>;
