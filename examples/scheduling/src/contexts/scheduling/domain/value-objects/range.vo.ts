import { ValueObject } from '@ddd-ts-kit/kernel';
import { CalendarError } from '@/contexts/scheduling/domain/errors/calendar.error';

export type RangeProps = {
  readonly startMinute: number;
  readonly endMinute: number;
};

const TIME_PATTERN = /^(\d{2}):(\d{2})$/;
const MINUTES_PER_HOUR = 60;
const END_OF_DAY = 24 * MINUTES_PER_HOUR;
/** The digits of an hour or of a minute written `HH:MM`. */
const TWO_DIGITS = 2;

/** A span of one day between two wall-clock times, written `HH:MM`; `24:00` is the end of the day. */
export class Range extends ValueObject<RangeProps> {
  private constructor(props: RangeProps) {
    super(props);
  }

  static create(start: string, end: string): Range {
    const startMinute = minuteOf(start);
    const endMinute = minuteOf(end);

    if (startMinute === undefined || endMinute === undefined) {
      throw CalendarError.invalidRange('is written with two times HH:MM of one day');
    }

    if (endMinute <= startMinute) {
      throw CalendarError.invalidRange('ends after it starts');
    }

    return new Range({ startMinute, endMinute });
  }

  /** Whether no two of these ranges share a minute. */
  static disjoint(ranges: readonly Range[]): boolean {
    return ranges.every((range, index) => ranges.slice(index + 1).every((other) => !range.overlaps(other)));
  }

  overlaps(other: Range): boolean {
    return this.startMinute < other.endMinute && other.startMinute < this.endMinute;
  }

  /** Whether a span of wall-clock minutes lies whole inside the range. */
  contains(startMinute: number, endMinute: number): boolean {
    return this.startMinute <= startMinute && endMinute <= this.endMinute;
  }

  get startMinute(): number {
    return this.props.startMinute;
  }

  get endMinute(): number {
    return this.props.endMinute;
  }

  get start(): string {
    return timeOf(this.props.startMinute);
  }

  get end(): string {
    return timeOf(this.props.endMinute);
  }
}

function minuteOf(time: string): number | undefined {
  const match = TIME_PATTERN.exec(time.trim());

  if (match === null) {
    return undefined;
  }

  const minute = Number(match[1]) * MINUTES_PER_HOUR + Number(match[2]);

  return Number(match[2]) < MINUTES_PER_HOUR && minute <= END_OF_DAY ? minute : undefined;
}

function timeOf(minute: number): string {
  const hours = String(Math.floor(minute / MINUTES_PER_HOUR)).padStart(TWO_DIGITS, '0');

  return `${hours}:${String(minute % MINUTES_PER_HOUR).padStart(TWO_DIGITS, '0')}`;
}
