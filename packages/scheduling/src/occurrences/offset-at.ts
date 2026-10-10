const formatters = new Map<string, Intl.DateTimeFormat>();

/** What the clocks of the zone show at an instant, minus the instant: positive east of Greenwich. */
export function offsetAt(timeZone: string, instant: number): number {
  if (timeZone === 'UTC') {
    return 0;
  }

  const shown = new Map(
    formatterOf(timeZone)
      .formatToParts(instant)
      .map((part) => [part.type, Number(part.value)]),
  );

  const field = (type: Intl.DateTimeFormatPartTypes): number => shown.get(type) ?? 0;

  const wallTime = Date.UTC(
    field('year'),
    field('month') - 1,
    field('day'),
    field('hour'),
    field('minute'),
    field('second'),
  );

  return wallTime - Math.floor(instant / 1_000) * 1_000;
}

function formatterOf(timeZone: string): Intl.DateTimeFormat {
  const known = formatters.get(timeZone);

  if (known !== undefined) {
    return known;
  }

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
