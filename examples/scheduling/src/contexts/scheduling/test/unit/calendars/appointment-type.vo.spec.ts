import { describe, expect, it } from 'vitest';
import { AppointmentType } from '@/contexts/scheduling/calendars/domain/value-objects/appointment-type.vo';
import { expectRefusal } from '@ddd-ts-kit/testing';

const consultation = {
  id: 'type-1',
  name: 'Consultation',
  duration: 30,
  grid: 15,
  buffer: 10,
  needsConfirmation: false,
};

describe('AppointmentType', () => {
  it('is equal to another type with the same facts', () => {
    const first = AppointmentType.create(consultation);

    expect(first.equals(AppointmentType.create({ ...consultation, name: ' Consultation ' }))).toBe(true);
    expect(first.equals(AppointmentType.create({ ...consultation, needsConfirmation: true }))).toBe(false);
  });

  it.each([
    ['a duration of zero', { duration: 0 }],
    ['a duration that is not whole minutes', { duration: 12.5 }],
    ['a grid of zero', { grid: 0 }],
    ['a grid that does not divide a day', { grid: 7 }],
    ['a negative buffer', { buffer: -5 }],
    ['an empty name', { name: '  ' }],
    ['an empty identifier', { id: '' }],
  ])('refuses %s', (_case, facts) => {
    expectRefusal(() => AppointmentType.create({ ...consultation, ...facts }), 'INVALID_APPOINTMENT_TYPE');
  });

  it.each([5, 15, 20, 30, 45, 60, 90, 1440])('accepts a grid of %i minutes, which divides a day', (grid) => {
    expect(() => AppointmentType.create({ ...consultation, grid })).not.toThrow();
  });

  it('holds its duration, then its buffer, from the start', () => {
    const slot = AppointmentType.create(consultation).slotAt(new Date('2026-03-02T09:00:00.000Z'));

    expect(slot.endsAt).toEqual(new Date('2026-03-02T09:30:00.000Z'));
    expect(slot.heldUntil).toEqual(new Date('2026-03-02T09:40:00.000Z'));
  });

  it.each([
    [0, true],
    [9 * 60 + 15, true],
    [9 * 60 + 20, false],
  ])('says whether minute %i from midnight is on its grid', (minute, expected) => {
    expect(AppointmentType.create(consultation).startsOn(minute)).toBe(expected);
  });
});
