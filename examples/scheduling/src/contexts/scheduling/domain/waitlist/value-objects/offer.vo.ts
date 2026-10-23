import { ValueObject } from '@ddd-ts-kit/kernel';
import { InvalidOffer } from '@/contexts/scheduling/domain/waitlist/errors/invalid-offer.error';
import type { Slot } from '@/contexts/scheduling/domain/calendars/value-objects/slot.vo';
import type { Waiter } from '@/contexts/scheduling/domain/waitlist/value-objects/waiter.vo';

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

  static create(props: OfferProps): Offer {
    if (Number.isNaN(props.expiresAt.getTime())) {
      throw InvalidOffer.forRule('expires at a real instant');
    }

    if (props.expiresAt.getTime() > props.slot.startsAt.getTime()) {
      throw InvalidOffer.forRule('expires before its slot starts');
    }

    return new Offer({ ...props, expiresAt: new Date(props.expiresAt) });
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
