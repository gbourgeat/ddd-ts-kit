import { describe, expect, it } from 'vitest';
import { TimeOff } from '@/contexts/scheduling/domain/calendars/value-objects/time-off.vo';
import { expectRefusal } from '@ddd-ts-kit/testing';

describe('TimeOff', () => {
  it('is equal to another time off over the same period', () => {
    const first = TimeOff.create(at('08:00'), at('12:00'));

    expect(first.equals(TimeOff.create(at('08:00'), at('12:00')))).toBe(true);
    expect(first.equals(TimeOff.create(at('08:00'), at('13:00')))).toBe(false);
  });

  it.each([
    ['ends when it starts', at('08:00'), at('08:00')],
    ['ends before it starts', at('09:00'), at('08:00')],
    ['starts at no real instant', new Date('never'), at('08:00')],
  ])('refuses a period that %s', (_case, startsAt, endsAt) => {
    expectRefusal(() => TimeOff.create(startsAt, endsAt), 'INVALID_TIME_OFF');
  });

  it.each([
    ['09:00', '09:30', true],
    ['11:59', '12:30', true],
    ['07:30', '08:01', true],
    ['12:00', '12:30', false],
    ['07:30', '08:00', false],
  ])('says whether a time off from 08:00 to 12:00 covers %s to %s', (start, end, covered) => {
    const morning = TimeOff.create(at('08:00'), at('12:00'));

    expect(morning.covers(at(start), at(end))).toBe(covered);
  });
});

function at(time: string): Date {
  return new Date(`2026-08-03T${time}:00.000Z`);
}
