import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { Offer } from '../value-objects/offer.vo.js';

export class WaitlistSlotOffered implements DomainEvent {
  readonly name = 'scheduling.waitlist.slot-offered';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    /** Who the freed slot is held for, what it holds and until when the offer waits. */
    readonly offer: Offer,
  ) {}
}
