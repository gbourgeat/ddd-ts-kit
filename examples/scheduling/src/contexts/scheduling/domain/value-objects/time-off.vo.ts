import { ValueObject } from '@ddd-ts-kit/kernel';
import { InvalidTimeOff } from '@/contexts/scheduling/domain/errors/invalid-time-off.error';

export type TimeOffProps = {
  readonly startsAt: Date;
  readonly endsAt: Date;
};

/** A period during which nothing can be booked, whatever the hours. */
export class TimeOff extends ValueObject<TimeOffProps> {
  private constructor(props: TimeOffProps) {
    super(props);
  }

  static create(startsAt: Date, endsAt: Date): TimeOff {
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw InvalidTimeOff.forRule('is made of real instants');
    }

    if (endsAt.getTime() <= startsAt.getTime()) {
      throw InvalidTimeOff.forRule('ends after it starts');
    }

    return new TimeOff({ startsAt: new Date(startsAt), endsAt: new Date(endsAt) });
  }

  /** Whether the time off has an instant in common with a span of time. */
  covers(startsAt: Date, endsAt: Date): boolean {
    return this.props.startsAt.getTime() < endsAt.getTime() && startsAt.getTime() < this.props.endsAt.getTime();
  }

  get startsAt(): Date {
    return new Date(this.props.startsAt);
  }

  get endsAt(): Date {
    return new Date(this.props.endsAt);
  }
}
