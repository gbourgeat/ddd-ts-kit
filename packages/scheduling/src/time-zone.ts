const DAY_MS = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

/**
 * The instants at which the clocks of the zone show a wall time, earliest first: none for a
 * time skipped when clocks are set forward, two for a time repeated when they are set back. A
 * wall time is written as the milliseconds it would be in UTC.
 */
export function instantsOfWallTime(timeZone: string, wallTime: number): number[] {
  const offsets = new Set([offsetAt(timeZone, wallTime - DAY_MS), offsetAt(timeZone, wallTime + DAY_MS)]);
  return [...offsets]
    .filter((offset) => offsetAt(timeZone, wallTime - offset) === offset)
    .map((offset) => wallTime - offset)
    .sort((left, right) => left - right);
}

/** What the clocks of the zone show at an instant, minus the instant: positive east of Greenwich. */
export function offsetAt(timeZone: string, instant: number): number {
  if (timeZone === 'UTC') return 0;
  const shown = new Map(
    formatterOf(timeZone)
      .formatToParts(instant)
      .map((part) => [part.type, Number(part.value)]),
  );
  const field = (type: Intl.DateTimeFormatPartTypes): number => shown.get(type) ?? 0;
  const wallTime = Date.UTC(field('year'), field('month') - 1, field('day'), field('hour'), field('minute'), field('second'));
  return wallTime - Math.floor(instant / 1_000) * 1_000;
}

function formatterOf(timeZone: string): Intl.DateTimeFormat {
  const known = formatters.get(timeZone);
  if (known !== undefined) return known;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  formatters.set(timeZone, formatter);
  return formatter;
}
