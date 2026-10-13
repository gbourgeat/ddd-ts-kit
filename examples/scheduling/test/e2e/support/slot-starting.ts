const HALF_HOUR = 30 * 60_000;
const DAY = 48 * HALF_HOUR;
/** Ten in the morning in UTC: whole hours from it, every practice here is in its working day. */
const DAYTIME = 20 * HALF_HOUR;

/**
 * The first start on a grid of thirty minutes at least this long after now, on the real clock:
 * a week ahead for a slot a patient may still cancel, a few hours ahead for one inside the
 * notice they owe the practice. The zones of the practices here are whole hours from UTC, so a
 * half hour of UTC is a half hour of their wall clock.
 *
 * A slot asked in days falls at ten in the morning, UTC, of the first day that is far enough:
 * the slots a journey books around it stay on its day, whatever the hour the suite runs at
 * (a slot taken at 23:30 put the next half hour on another day of occupancy).
 */
export function slotStarting(ahead: { readonly days?: number; readonly hours?: number }): Date {
  const earliest = Date.now() + (ahead.days ?? 0) * DAY + (ahead.hours ?? 0) * 2 * HALF_HOUR;

  if (ahead.days === undefined) {
    return new Date(Math.ceil(earliest / HALF_HOUR) * HALF_HOUR);
  }

  const daytime = Math.floor(earliest / DAY) * DAY + DAYTIME;

  return new Date(daytime >= earliest ? daytime : daytime + DAY);
}
