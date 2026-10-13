import { ValueObject } from '@ddd-ts-kit/kernel';
import { DelegationError } from '{{alias.context}}/domain/errors/delegation.error{{alias.ext}}';

/** A delegation is a stand-in for an absence: past this, the right belongs in a role. */
const LONGEST_DAYS = 90;
const DAY_MS = 86_400_000;

export type DelegationPeriodProps = {
  readonly startsAt: Date;
  readonly endsAt: Date;
};

/** When a delegation holds: from its start, included, to its end, excluded, for at most ninety days. */
export class DelegationPeriod extends ValueObject<DelegationPeriodProps> {
  private constructor(props: DelegationPeriodProps) {
    super(props);
  }

  static create(startsAt: Date, endsAt: Date): DelegationPeriod {
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw DelegationError.periodInverted(startsAt, endsAt);
    }

    if (endsAt.getTime() - startsAt.getTime() > LONGEST_DAYS * DAY_MS) {
      throw DelegationError.tooLong(LONGEST_DAYS);
    }

    return new DelegationPeriod({ startsAt, endsAt });
  }

  includes(instant: Date): boolean {
    return this.props.startsAt.getTime() <= instant.getTime() && instant.getTime() < this.props.endsAt.getTime();
  }

  get startsAt(): Date {
    return this.props.startsAt;
  }

  get endsAt(): Date {
    return this.props.endsAt;
  }
}
