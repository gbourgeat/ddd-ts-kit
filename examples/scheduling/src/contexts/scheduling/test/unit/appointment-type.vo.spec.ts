import { describe, expect, it } from 'vitest';
import { unwrap } from '@ddd-ts-kit/kernel';
import { AppointmentType } from '@/contexts/scheduling/domain/value-objects/appointment-type.vo';

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
    const first = unwrap(AppointmentType.create(consultation));

    expect(first.equals(unwrap(AppointmentType.create({ ...consultation, name: ' Consultation ' })))).toBe(true);
    expect(first.equals(unwrap(AppointmentType.create({ ...consultation, needsConfirmation: true })))).toBe(false);
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
    const result = AppointmentType.create({ ...consultation, ...facts });

    expect(result).toMatchObject({ ok: false, error: expect.objectContaining({ code: 'INVALID_APPOINTMENT_TYPE' }) });
  });

  it.each([5, 15, 20, 30, 45, 60, 90, 1440])('accepts a grid of %i minutes, which divides a day', (grid) => {
    expect(AppointmentType.create({ ...consultation, grid }).ok).toBe(true);
  });

  it('holds its duration, then its buffer, from the start', () => {
    const slot = unwrap(AppointmentType.create(consultation)).slotAt(new Date('2026-03-02T09:00:00.000Z'));

    expect(slot.endsAt).toEqual(new Date('2026-03-02T09:30:00.000Z'));
    expect(slot.heldUntil).toEqual(new Date('2026-03-02T09:40:00.000Z'));
  });

  it.each([
    [0, true],
    [9 * 60 + 15, true],
    [9 * 60 + 20, false],
  ])('says whether minute %i from midnight is on its grid', (minute, expected) => {
    expect(unwrap(AppointmentType.create(consultation)).startsOn(minute)).toBe(expected);
  });
});
