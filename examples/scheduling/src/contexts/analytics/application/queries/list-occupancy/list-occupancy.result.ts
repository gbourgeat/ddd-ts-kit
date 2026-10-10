import type { Page } from '@ddd-ts-kit/kernel';
import type { Occupancy } from '../../ports/occupancy-register.port.js';

export type ListOccupancyResult = Page<Occupancy>;
