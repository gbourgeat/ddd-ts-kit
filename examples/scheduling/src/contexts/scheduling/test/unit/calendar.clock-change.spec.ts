import { describe, expect, it } from 'vitest';
import { OutsideAvailabilityError } from '#src/contexts/scheduling/domain/errors/outside-availability.error.js';
import { Slot } from '#src/contexts/scheduling/domain/value-objects/slot.vo.js';
import { aCalendar } from '#src/contexts/scheduling/test/builders/calendar.builder.js';

describe('Calendar, on the days the clock of Europe/Paris changes', () => {
  it.each([
    ['the day before the clock goes forward (UTC+1)', '2026-03-28T08:00:00.000Z'],
    ['the day the clock goes forward (UTC+2)', '2026-03-29T07:00:00.000Z'],
    ['the day before the clock goes back (UTC+2)', '2026-10-24T07:00:00.000Z'],
    ['the day the clock goes back (UTC+1)', '2026-10-25T08:00:00.000Z'],
  ])('opens at 09:00 on the wall clock %s', (_case, opening) => {
    const calendar = open().build();
    const booking = new Date(instant(opening).getTime() - 24 * 3_600_000);

    expect(calendar.slotFor('consultation', instant(opening), booking)).toBeInstanceOf(Slot);

    expect(() => calendar.slotFor('consultation', new Date(instant(opening).getTime() - 30 * 60_000), booking)).toThrow(
      OutsideAvailabilityError,
    );
  });

  it.each([
    ['forward', '2026-03-29T16:00:00.000Z'],
    ['back', '2026-10-25T17:00:00.000Z'],
  ])('closes at 18:00 on the wall clock the day the clock goes %s', (_case, closing) => {
    const calendar = open().build();
    const booking = new Date(instant(closing).getTime() - 24 * 3_600_000);

    expect(
      calendar.slotFor('consultation', new Date(instant(closing).getTime() - 30 * 60_000), booking),
    ).toBeInstanceOf(Slot);

    expect(() => calendar.slotFor('consultation', instant(closing), booking)).toThrow(OutsideAvailabilityError);
  });

  it('takes no appointment that would end in the hour the clock skips', () => {
    const night = aCalendar()
      .openEveryDay(['01:00', '03:00'])
      .offering('consultation', { duration: 60, grid: 30 })
      .build();

    const booking = instant('2026-03-28T00:00:00.000Z');

    // 01:00 to 02:00 on the wall clock: the clock reads 03:00 when it ends, which is the closing time.
    expect(night.slotFor('consultation', instant('2026-03-29T00:00:00.000Z'), booking)).toBeInstanceOf(Slot);

    // 01:30 on the wall clock, an hour later the clock reads 03:30: past the closing time.
    expect(() => night.slotFor('consultation', instant('2026-03-29T00:30:00.000Z'), booking)).toThrow(
      OutsideAvailabilityError,
    );
  });

  it('takes both passes of the hour the clock shows twice', () => {
    const night = aCalendar().openEveryDay(['02:00', '03:00']).offering('consultation').build();
    const booking = instant('2026-10-24T00:00:00.000Z');

    expect(night.slotFor('consultation', instant('2026-10-25T00:30:00.000Z'), booking)).toBeInstanceOf(Slot);
    expect(night.slotFor('consultation', instant('2026-10-25T01:30:00.000Z'), booking)).toBeInstanceOf(Slot);

    expect(() => night.slotFor('consultation', instant('2026-10-25T02:00:00.000Z'), booking)).toThrow(
      OutsideAvailabilityError,
    );
  });
});

/** Open 09:00 to 12:00 and 14:00 to 18:00 on the wall clock of Paris, offering a consultation of thirty minutes on a grid of thirty. */
function open() {
  return aCalendar().openEveryDay(['09:00', '12:00'], ['14:00', '18:00']).offering('consultation');
}

function instant(text: string): Date {
  return new Date(text);
}
