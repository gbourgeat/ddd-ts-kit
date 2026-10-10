import { ValueObject, err, ok, type Result } from '@ddd-ts-kit/kernel';
import { InvalidDayError } from '../errors/invalid-day.error.js';

export type DayProps = {
  readonly value: string;
};

const WRITTEN = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECONDS_A_DAY = 86_400_000;

export class Day extends ValueObject<DayProps> {
  private constructor(props: DayProps) {
    super(props);
  }

  static create(value: string): Result<Day, InvalidDayError> {
    const written = value.trim();

    if (!WRITTEN.test(written) || !exists(written)) {
      return err(new InvalidDayError(value));
    }

    return ok(new Day({ value: written }));
  }

  /** The calendar date of an instant, read in UTC. */
  static containing(instant: Date): Day {
    return new Day({ value: instant.toISOString().slice(0, 10) });
  }

  /** The day that many days earlier. */
  minus(days: number): Day {
    return Day.containing(new Date(Date.parse(this.props.value) - days * MILLISECONDS_A_DAY));
  }

  get value(): string {
    return this.props.value;
  }
}

function exists(written: string): boolean {
  const instant = new Date(written);

  return !Number.isNaN(instant.getTime()) && instant.toISOString().slice(0, 10) === written;
}
