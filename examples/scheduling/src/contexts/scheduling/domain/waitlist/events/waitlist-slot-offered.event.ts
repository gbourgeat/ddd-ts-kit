import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { Offer } from '@/contexts/scheduling/domain/waitlist/value-objects/offer.vo';

export class WaitlistSlotOffered implements DomainEvent {
  static readonly eventName = 'scheduling.waitlist.slot-offered';

  readonly name = WaitlistSlotOffered.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    /** Who the freed slot is held for, what it holds and until when the offer waits. */
    readonly offer: Offer,
  ) {}
}
