/** How an appointment stands for measurement. */
export type OutcomeState = 'held' | 'completed' | 'no-show' | 'cancelled-by-patient' | 'cancelled-by-practice' | 'expired';

/** What the measure reads of the outcome of one appointment. */
export type MeasuredOutcome = {
  readonly state: OutcomeState;
  readonly startsAt: Date;
  readonly endsAt: Date;
};

/** The occupancy of a calendar over a day. */
export type OccupancyFigures = {
  /** The minutes of the appointments that hold their time: held, completed or missed by the patient. */
  readonly heldMinutes: number;
  /** How many appointments hold their time. */
  readonly appointmentsHeld: number;
  readonly completed: number;
  readonly noShows: number;
  readonly cancelledByPatient: number;
  readonly cancelledByPractice: number;
};

const HOLDING: readonly OutcomeState[] = ['held', 'completed', 'no-show'];
const MILLISECONDS_A_MINUTE = 60_000;

export class OccupancyMeasureService {
  /** Counts from nothing each time: the same outcomes always give the same figures. */
  measure(outcomes: readonly MeasuredOutcome[]): OccupancyFigures {
    const holding = outcomes.filter((outcome) => HOLDING.includes(outcome.state));
    const count = (state: OutcomeState): number => outcomes.filter((outcome) => outcome.state === state).length;

    return {
      heldMinutes: holding.reduce((minutes, outcome) => minutes + minutesOf(outcome), 0),
      appointmentsHeld: holding.length,
      completed: count('completed'),
      noShows: count('no-show'),
      cancelledByPatient: count('cancelled-by-patient'),
      cancelledByPractice: count('cancelled-by-practice'),
    };
  }
}

function minutesOf(outcome: MeasuredOutcome): number {
  return Math.round((outcome.endsAt.getTime() - outcome.startsAt.getTime()) / MILLISECONDS_A_MINUTE);
}
