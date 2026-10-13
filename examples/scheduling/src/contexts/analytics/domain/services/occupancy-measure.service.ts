import type { MeasuredOutcome } from '@/contexts/analytics/domain/value-objects/measured-outcome.vo';
import { OccupancyFigures } from '@/contexts/analytics/domain/value-objects/occupancy-figures.vo';
import { OutcomeState } from '@/contexts/analytics/domain/vocabularies/outcome-state.vocabulary';

/**
 * What occupancy means. The read of the occupancy computes the same figures in its statement,
 * from the same outcomes: the contract of `OccupancyReader` holds the two equal.
 */
export class OccupancyMeasureService {
  /** The outcomes that hold their time: a cancelled or an expired appointment frees it. */
  static readonly HOLDING: readonly OutcomeState[] = [OutcomeState.Held, OutcomeState.Completed, OutcomeState.NoShow];

  /** Counts from nothing each time: the same outcomes always give the same figures. */
  measure(outcomes: readonly MeasuredOutcome[]): OccupancyFigures {
    const holding = outcomes.filter((outcome) => outcome.isIn(OccupancyMeasureService.HOLDING));
    const count = (state: OutcomeState): number => outcomes.filter((outcome) => outcome.isIn([state])).length;

    return OccupancyFigures.of({
      heldMinutes: holding.reduce((minutes, outcome) => minutes + outcome.minutes, 0),
      appointmentsHeld: holding.length,
      completed: count(OutcomeState.Completed),
      noShows: count(OutcomeState.NoShow),
      cancelledByPatient: count(OutcomeState.CancelledByPatient),
      cancelledByPractice: count(OutcomeState.CancelledByPractice),
    });
  }
}
