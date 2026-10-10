import { describe, expect, it } from 'vitest';
import { unwrap } from '@ddd-ts-kit/kernel';
import { InvalidBookingWindowError } from '#src/contexts/scheduling/domain/errors/invalid-booking-window.error.js';
import { BookingWindow } from '#src/contexts/scheduling/domain/value-objects/booking-window.vo.js';

const now = new Date('2026-03-02T08:00:00.000Z');

describe('BookingWindow', () => {
  it('is equal to another window with the same notice and horizon', () => {
    expect(unwrap(BookingWindow.create(120, 129_600)).equals(BookingWindow.standard())).toBe(true);
    expect(unwrap(BookingWindow.create(60, 129_600)).equals(BookingWindow.standard())).toBe(false);
  });

  it.each([
    ['a negative notice', -1, 60],
    ['a notice that is not whole minutes', 1.5, 60],
    ['a horizon that does not come after the notice', 60, 60],
  ])('refuses %s', (_case, notice, horizon) => {
    expect(BookingWindow.create(notice, horizon)).toMatchObject({
      ok: false,
      error: expect.any(InvalidBookingWindowError),
    });
  });

  it('is by default a notice of two hours and a horizon of ninety days', () => {
    expect(BookingWindow.standard()).toMatchObject({ notice: 120, horizon: 90 * 24 * 60 });
  });

  it.each([
    [119, true],
    [120, false],
  ])('says whether a start in %i minutes comes too late for a notice of two hours', (minutes, tooLate) => {
    expect(BookingWindow.standard().isTooLate(inMinutes(minutes), now)).toBe(tooLate);
  });

  it.each([
    [129_600, false],
    [129_601, true],
  ])('says whether a start in %i minutes is too far for a horizon of ninety days', (minutes, tooFar) => {
    expect(BookingWindow.standard().isTooFar(inMinutes(minutes), now)).toBe(tooFar);
  });
});

function inMinutes(minutes: number): Date {
  return new Date(now.getTime() + minutes * 60_000);
}
