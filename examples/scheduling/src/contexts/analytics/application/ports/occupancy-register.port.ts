import { ReadModelStore, defineCriteria } from '@ddd-ts-kit/kernel';
import type { OccupancyFigures } from '../../domain/services/occupancy-measure.service.js';

/** The occupancy of a calendar over a day, under the key `<calendarId>.<day>`. */
export type Occupancy = OccupancyFigures & {
  readonly id: string;
  readonly practiceId: string;
  readonly calendarId: string;
  /** A calendar date in the time zone of the practice, `YYYY-MM-DD`. */
  readonly day: string;
};

export const occupancyCriteria = defineCriteria<Occupancy>({
  fields: {
    id: { type: 'string' },
    practiceId: { type: 'string', filter: ['eq'] },
    calendarId: { type: 'string', filter: ['eq', 'in'], sortable: true },
    day: { type: 'string', filter: ['eq', 'gte', 'lte', 'between'], sortable: true },
    heldMinutes: { type: 'number', sortable: true },
    appointmentsHeld: { type: 'number' },
    completed: { type: 'number' },
    noShows: { type: 'number' },
    cancelledByPatient: { type: 'number' },
    cancelledByPractice: { type: 'number' },
  },
  defaultSort: [{ field: 'day', direction: 'asc' }],
  tieBreaker: 'id',
  limits: { maxPageSize: 100 },
});

export abstract class OccupancyRegister extends ReadModelStore<Occupancy> {}
