import { ConceptError } from '@ddd-ts-kit/kernel';

export class OccupancyError extends ConceptError {
  static outcomeEndsBeforeStart(startsAt: string, endsAt: string) {
    return OccupancyError.refusal(
      'OUTCOME_ENDS_BEFORE_START',
      `An outcome cannot end at ${endsAt}, before it starts at ${startsAt}: the time it covers would be negative.`,
      { startsAt, endsAt },
    );
  }

  static figuresInconsistent(rule: string) {
    return OccupancyError.refusal('FIGURES_INCONSISTENT', `The figures of a line of occupancy ${rule}.`, { rule });
  }
}
