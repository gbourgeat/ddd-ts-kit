import { ValueObject, err, ok, type Result } from '@ddd-ts-kit/kernel';
import { UnknownTimeZoneError } from '../errors/unknown-time-zone.error.js';

export type TimeZoneProps = {
  readonly name: string;
};

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The zone whose wall clock the practice lives by: it turns an instant into a day and a time of that clock, and back. */
export class TimeZone extends ValueObject<TimeZoneProps> {
  private constructor(props: TimeZoneProps) {
    super(props);
  }

  /** An IANA zone name, as the runtime knows it (`Europe/Paris`). */
  static create(name: string): Result<TimeZone, UnknownTimeZoneError> {
    const trimmed = name.trim();

    try {
      const canonical = new Intl.DateTimeFormat('en-US', { timeZone: trimmed }).resolvedOptions().timeZone;

      return trimmed.length === 0 ? err(new UnknownTimeZoneError(name)) : ok(new TimeZone({ name: canonical }));
    } catch {
      return err(new UnknownTimeZoneError(name));
    }
  }

  /** Whether the text is a real date written `YYYY-MM-DD`. */
  static isDay(day: string): boolean {
    const match = DAY_PATTERN.exec(day);

    if (match === null) return false;

    const date = new Date(`${day}T00:00:00.000Z`);

    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(day);
  }

  /** The day of the instant on the wall clock of the zone, `YYYY-MM-DD`. */
  dayOf(instant: Date): string {
    const parts = this.wallClockOf(instant);

    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  /** The minutes from midnight the wall clock of the zone shows at the instant. */
  minuteOf(instant: Date): number {
    const parts = this.wallClockOf(instant);

    return Number(parts.hour) * 60 + Number(parts.minute);
  }

  /**
   * The instant at which the wall clock of the zone shows this minute of this day. A time the
   * clock shows twice (autumn) is the first one; a time it skips (spring) is read as if the
   * clock had not jumped yet, which lands after the jump.
   */
  instantAt(day: string, minute: number): Date {
    const wall = new Date(`${day}T00:00:00.000Z`).getTime() + minute * MINUTE;
    const candidates = [wall - this.offsetAt(wall - DAY), wall - this.offsetAt(wall + DAY)];
    const shown = candidates.filter((candidate) => candidate + this.offsetAt(candidate) === wall);

    return new Date(shown.length === 0 ? Math.max(...candidates) : Math.min(...shown));
  }

  get name(): string {
    return this.props.name;
  }

  /** What the wall clock is ahead of UTC at the instant, in milliseconds. */
  private offsetAt(time: number): number {
    const parts = this.wallClockOf(new Date(time));
    const shown = new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00.000Z`).getTime();

    return shown - Math.floor(time / MINUTE) * MINUTE;
  }

  private wallClockOf(instant: Date): Record<'year' | 'month' | 'day' | 'hour' | 'minute', string> {
    const format = new Intl.DateTimeFormat('en-US', {
      timeZone: this.props.name,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const read = (type: Intl.DateTimeFormatPartTypes): string => format.formatToParts(instant).find((part) => part.type === type)?.value ?? '';

    return { year: read('year').padStart(4, '0'), month: read('month'), day: read('day'), hour: read('hour'), minute: read('minute') };
  }
}
