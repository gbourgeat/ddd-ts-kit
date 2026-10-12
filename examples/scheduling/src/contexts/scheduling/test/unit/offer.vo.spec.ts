import { describe, expect, it } from 'vitest';
import { Offer } from '@/contexts/scheduling/domain/value-objects/offer.vo';
import { Slot } from '@/contexts/scheduling/domain/value-objects/slot.vo';
import { Waiter } from '@/contexts/scheduling/domain/value-objects/waiter.vo';
import { expectRefusal } from '@ddd-ts-kit/testing';

const waiter = Waiter.create({
  patientId: 'patient-1',
  appointmentTypeId: 'consultation',
  joinedAt: new Date('2026-03-01T08:00:00.000Z'),
});

const slot = Slot.between(at('09:00'), at('09:30'), at('09:40'));

describe('Offer', () => {
  it('is equal to another offer of the same slot to the same waiter until the same instant', () => {
    const first = Offer.create({ waiter, slot, expiresAt: at('08:30') });

    expect(first.equals(Offer.create({ waiter, slot, expiresAt: at('08:30') }))).toBe(true);
    expect(first.equals(Offer.create({ waiter, slot, expiresAt: at('08:45') }))).toBe(false);
  });

  it('may wait until its slot starts, and no longer', () => {
    expect(() => Offer.create({ waiter, slot, expiresAt: at('09:00') })).not.toThrow();

    expectRefusal(() => Offer.create({ waiter, slot, expiresAt: at('09:01') }), 'INVALID_OFFER');
  });

  it('refuses a hold that ends at no real instant', () => {
    expectRefusal(() => Offer.create({ waiter, slot, expiresAt: new Date('never') }), 'INVALID_OFFER');
  });

  it('keeps who it is for, what it holds and until when it waits', () => {
    const offer = Offer.create({ waiter, slot, expiresAt: at('08:30') });

    expect(offer.waiter.equals(waiter)).toBe(true);
    expect(offer.slot.equals(slot)).toBe(true);
    expect(offer.expiresAt).toEqual(at('08:30'));
  });
});

function at(time: string): Date {
  return new Date(`2026-03-02T${time}:00.000Z`);
}
