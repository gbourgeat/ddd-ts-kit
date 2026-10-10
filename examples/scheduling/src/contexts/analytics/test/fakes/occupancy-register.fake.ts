import { InMemoryReadModelStore } from '@ddd-ts-kit/kernel';
import { occupancyCriteria, type Occupancy, type OccupancyRegister } from '../../application/ports/occupancy-register.port.js';

export class FakeOccupancyRegister extends InMemoryReadModelStore<Occupancy> implements OccupancyRegister {
  constructor() {
    super(occupancyCriteria);
  }
}
