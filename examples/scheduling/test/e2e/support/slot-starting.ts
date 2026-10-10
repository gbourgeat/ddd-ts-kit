const HALF_HOUR = 30 * 60_000;

/**
 * The first start on a grid of thirty minutes at least this long after now, on the real clock:
 * a week ahead for a slot a patient may still cancel, a few hours ahead for one inside the
 * notice they owe the practice. The zones of the practices here are whole hours from UTC, so a
 * half hour of UTC is a half hour of their wall clock.
 */
export function slotStarting(ahead: { readonly days?: number; readonly hours?: number }): Date {
  const earliest = Date.now() + (ahead.days ?? 0) * 48 * HALF_HOUR + (ahead.hours ?? 0) * 2 * HALF_HOUR;

  return new Date(Math.ceil(earliest / HALF_HOUR) * HALF_HOUR);
}
