import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, KnexReadModelStore } from '@ddd-ts-kit/knex';
import { OccupancyRegister, occupancyCriteria, type Occupancy } from '../../application/ports/occupancy-register.port.js';
import { ANALYTICS_SCHEMA } from './analytics.schema.js';

@Repository(OccupancyRegister, [KnexContext])
export class KnexOccupancyRegister extends KnexReadModelStore<Occupancy> implements OccupancyRegister {
  constructor(context: KnexContext) {
    super(context, {
      schema: ANALYTICS_SCHEMA,
      table: 'occupancy',
      columns: {
        id: 'id',
        practiceId: 'practice_id',
        calendarId: 'calendar_id',
        day: 'day',
        heldMinutes: 'held_minutes',
        appointmentsHeld: 'appointments_held',
        completed: 'completed',
        noShows: 'no_shows',
        cancelledByPatient: 'cancelled_by_patient',
        cancelledByPractice: 'cancelled_by_practice',
      },
      definition: occupancyCriteria,
    });
  }
}
