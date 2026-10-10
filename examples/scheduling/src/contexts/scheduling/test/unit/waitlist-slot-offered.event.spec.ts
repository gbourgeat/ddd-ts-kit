import { describe, expect, it } from 'vitest';
import { unwrap } from '@ddd-ts-kit/kernel';
import { WaitlistSlotOffered } from '@/contexts/scheduling/domain/events/waitlist-slot-offered.event.js';
import { Offer } from '@/contexts/scheduling/domain/value-objects/offer.vo.js';
import { Slot } from '@/contexts/scheduling/domain/value-objects/slot.vo.js';
import { Waiter } from '@/contexts/scheduling/domain/value-objects/waiter.vo.js';

describe('WaitlistSlotOffered', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const waiter = unwrap(
      Waiter.create({
        patientId: 'patient-1',
        appointmentTypeId: 'consultation',
        joinedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );

    const slot = Slot.between(
      new Date('2026-03-02T09:00:00.000Z'),
      new Date('2026-03-02T09:30:00.000Z'),
      new Date('2026-03-02T09:30:00.000Z'),
    );

    const event = new WaitlistSlotOffered(
      'waitlist-1',
      new Date('2026-01-01T00:00:00.000Z'),
      unwrap(Offer.create({ waiter, slot, expiresAt: new Date('2026-01-01T00:30:00.000Z') })),
    );

    expect(event.name).toBe('scheduling.waitlist.slot-offered');
    expect(event.aggregateId).toBe('waitlist-1');
  });
});
