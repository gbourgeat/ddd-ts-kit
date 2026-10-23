import { describe, expect, it } from 'vitest';
import { WaitlistSlotOffered } from '@/contexts/scheduling/domain/waitlist/events/waitlist-slot-offered.event';
import { Offer } from '@/contexts/scheduling/domain/waitlist/value-objects/offer.vo';
import { Slot } from '@/contexts/scheduling/domain/calendars/value-objects/slot.vo';
import { Waiter } from '@/contexts/scheduling/domain/waitlist/value-objects/waiter.vo';

describe('WaitlistSlotOffered', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const waiter = Waiter.create({
      patientId: 'patient-1',
      appointmentTypeId: 'consultation',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const slot = Slot.between(
      new Date('2026-03-02T09:00:00.000Z'),
      new Date('2026-03-02T09:30:00.000Z'),
      new Date('2026-03-02T09:30:00.000Z'),
    );

    const event = new WaitlistSlotOffered(
      'waitlist-1',
      new Date('2026-01-01T00:00:00.000Z'),
      Offer.create({ waiter, slot, expiresAt: new Date('2026-01-01T00:30:00.000Z') }),
    );

    expect(event.name).toBe('scheduling.waitlist.slot-offered');
    expect(event.aggregateId).toBe('waitlist-1');
  });
});
