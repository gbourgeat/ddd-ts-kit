import { ValueObject } from '@ddd-ts-kit/kernel';
import { OutcomePeriodInverted } from '@/contexts/analytics/domain/errors/outcome-period-inverted.error';
import type { OutcomeState } from '@/contexts/analytics/domain/vocabularies/outcome-state.vocabulary';

export type MeasuredOutcomeProps = {
  readonly state: OutcomeState;
  readonly startsAt: Date;
  readonly endsAt: Date;
};

const MILLISECONDS_A_MINUTE = 60_000;

/** What the measure reads of the outcome of one appointment: how it stands, and the time it covers. */
export class MeasuredOutcome extends ValueObject<MeasuredOutcomeProps> {
  private constructor(props: MeasuredOutcomeProps) {
    super(props);
  }

  /** Refuses an outcome that ends before it starts: the time it covers is never negative. */
  static of(state: OutcomeState, startsAt: Date, endsAt: Date): MeasuredOutcome {
    if (endsAt.getTime() < startsAt.getTime()) {
      throw OutcomePeriodInverted.forPeriod(startsAt.toISOString(), endsAt.toISOString());
    }

    return new MeasuredOutcome({ state, startsAt: new Date(startsAt), endsAt: new Date(endsAt) });
  }

  /** Whether the appointment stands in one of these states. */
  isIn(states: readonly OutcomeState[]): boolean {
    return states.includes(this.props.state);
  }

  /** The time the appointment covers, to the nearest minute. */
  get minutes(): number {
    return Math.round((this.props.endsAt.getTime() - this.props.startsAt.getTime()) / MILLISECONDS_A_MINUTE);
  }

  get state(): OutcomeState {
    return this.props.state;
  }
}
