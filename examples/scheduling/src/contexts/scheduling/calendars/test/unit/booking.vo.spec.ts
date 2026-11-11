import { describe, expect, it } from 'vitest';
import { Booking, type BookingProps } from '@/contexts/scheduling/calendars/domain/value-objects/booking.vo';
import { Slot } from '@/contexts/scheduling/calendars/domain/value-objects/slot.vo';
import { expectRefusal } from '@ddd-ts-kit/testing';

const morning: BookingProps = {
  calendarId: 'calendar-1',
  practiceId: 'practice-1',
  practitionerId: 'practitioner-1',
  patientId: 'patient-1',
  appointmentTypeId: 'consultation',
  slot: Slot.between(at('09:00'), at('09:30'), at('09:40')),
  day: '2026-03-02',
};

describe('Booking', () => {
  it('is equal to another booking of the same slot for the same patient', () => {
    const first = Booking.create(morning);
    const second = Booking.create({ ...morning, slot: Slot.between(at('09:00'), at('09:30'), at('09:40')) });

    expect(first.equals(second)).toBe(true);
  });

  it('differs from the booking of another patient', () => {
    const first = Booking.create(morning);
    const second = Booking.create({ ...morning, patientId: 'patient-2' });

    expect(first.equals(second)).toBe(false);
  });

  it.each(['calendarId', 'practiceId', 'practitionerId', 'patientId', 'appointmentTypeId'] as const)(
    'refuses a booking whose %s is empty',
    (field) => {
      expectRefusal(() => Booking.create({ ...morning, [field]: '  ' }), 'INVALID_BOOKING');
    },
  );

  it.each(['', '02/03/2026', '2026-3-2', 'the 2026-03-02', '2026-03-02T09:00:00Z'])(
    'refuses the day "%s", which is no calendar date',
    (day) => {
      expectRefusal(() => Booking.create({ ...morning, day }), 'INVALID_BOOKING');
    },
  );

  it('moves to another slot and keeps everything else', () => {
    const afternoon = Slot.between(
      at('23:30'),
      new Date('2026-03-03T00:00:00.000Z'),
      new Date('2026-03-03T00:10:00.000Z'),
    );

    const moved = Booking.create(morning).movedTo(afternoon, '2026-03-03');

    expect(moved.slot.equals(afternoon)).toBe(true);
    expect(moved.day).toBe('2026-03-03');
    expect(moved.equals(Booking.create({ ...morning, slot: afternoon, day: '2026-03-03' }))).toBe(true);
  });

  it('leaves the booking it moves from as it was', () => {
    const booking = Booking.create(morning);

    booking.movedTo(Slot.between(at('10:00'), at('10:30'), at('10:30')), '2026-03-02');

    expect(booking.slot.startsAt).toEqual(at('09:00'));
  });
});

function at(time: string): Date {
  return new Date(`2026-03-02T${time}:00.000Z`);
}
