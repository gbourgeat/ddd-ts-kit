import { ReadModelStore, defineCriteria } from '@ddd-ts-kit/kernel';
import type { OutcomeState } from '@/contexts/analytics/domain/vocabularies/outcome-state.vocabulary';

/** How one appointment stands for measurement, under the identifier of the appointment. */
export type Outcome = {
  readonly id: string;
  readonly practiceId: string;
  readonly calendarId: string;
  /** The date of the start in the time zone of the practice, `YYYY-MM-DD`. */
  readonly day: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly state: OutcomeState;
  /** When scheduling last changed the appointment. */
  readonly changedAt: Date;
};

export const outcomeCriteria = defineCriteria<Outcome>({
  fields: {
    id: { type: 'string' },
    practiceId: { type: 'string' },
    calendarId: { type: 'string', filter: ['eq'] },
    day: { type: 'string', filter: ['eq', 'between'], sortable: true },
    startsAt: { type: 'instant' },
    endsAt: { type: 'instant' },
    state: { type: 'string' },
    changedAt: { type: 'instant' },
  },
  defaultSort: [{ field: 'day', direction: 'asc' }],
  tieBreaker: 'id',
});

export abstract class OutcomeRegister extends ReadModelStore<Outcome> {}
