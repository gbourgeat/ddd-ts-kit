import { ValueObject, err, ok, type Result } from '@ddd-ts-kit/kernel';
import { InvalidRangeError } from '@/contexts/scheduling/domain/errors/invalid-range.error.js';

export type RangeProps = {
  readonly startMinute: number;
  readonly endMinute: number;
};

const TIME_PATTERN = /^(\d{2}):(\d{2})$/;
const END_OF_DAY = 24 * 60;

/** A span of one day between two wall-clock times, written `HH:MM`; `24:00` is the end of the day. */
export class Range extends ValueObject<RangeProps> {
  private constructor(props: RangeProps) {
    super(props);
  }

  static create(start: string, end: string): Result<Range, InvalidRangeError> {
    const startMinute = minuteOf(start);
    const endMinute = minuteOf(end);

    if (startMinute === undefined || endMinute === undefined) {
      return err(new InvalidRangeError('is written with two times HH:MM of one day'));
    }

    if (endMinute <= startMinute) {
      return err(new InvalidRangeError('ends after it starts'));
    }

    return ok(new Range({ startMinute, endMinute }));
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

  const minute = Number(match[1]) * 60 + Number(match[2]);

  return Number(match[2]) < 60 && minute <= END_OF_DAY ? minute : undefined;
}

function timeOf(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}
