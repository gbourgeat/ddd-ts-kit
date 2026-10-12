import { ValueObject, err, ok, type Result } from '@ddd-ts-kit/kernel';
import { WaitlistError } from '@/contexts/scheduling/domain/errors/waitlist.error';
import type { Slot } from '@/contexts/scheduling/domain/value-objects/slot.vo';
import type { Waiter } from '@/contexts/scheduling/domain/value-objects/waiter.vo';

export type OfferProps = {
  readonly waiter: Waiter;
  readonly slot: Slot;
  /** The end of the hold: the instant until which the offer waits for its waiter. */
  readonly expiresAt: Date;
};

/** A freed slot held for one waiter until a deadline. */
export class Offer extends ValueObject<OfferProps> {
  private constructor(props: OfferProps) {
    super(props);
  }

  static create(props: OfferProps): Result<Offer, WaitlistError> {
    if (Number.isNaN(props.expiresAt.getTime())) {
      return err(WaitlistError.invalidOffer('expires at a real instant'));
    }

    if (props.expiresAt.getTime() > props.slot.startsAt.getTime()) {
      return err(WaitlistError.invalidOffer('expires before its slot starts'));
    }

    return ok(new Offer({ ...props, expiresAt: new Date(props.expiresAt) }));
  }

  get waiter(): Waiter {
    return this.props.waiter;
  }

  get slot(): Slot {
    return this.props.slot;
  }

  get expiresAt(): Date {
    return new Date(this.props.expiresAt);
  }
}
