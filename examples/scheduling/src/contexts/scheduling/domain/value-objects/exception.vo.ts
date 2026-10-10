import { ValueObject, err, ok, type Result } from '@ddd-ts-kit/kernel';
import { InvalidDayError } from '#src/contexts/scheduling/domain/errors/invalid-day.error.js';
import { InvalidRangeError } from '#src/contexts/scheduling/domain/errors/invalid-range.error.js';
import { Range } from '#src/contexts/scheduling/domain/value-objects/range.vo.js';
import { TimeZone } from '#src/contexts/scheduling/domain/value-objects/time-zone.vo.js';

export type ExceptionProps = {
  readonly day: string;
  readonly ranges: readonly Range[];
};

/** A day whose hours replace the weekly ones: closed when it has no range, opened on its ranges otherwise. */
export class Exception extends ValueObject<ExceptionProps> {
  private constructor(props: ExceptionProps) {
    super(props);
  }

  static create(day: string, ranges: readonly Range[]): Result<Exception, InvalidDayError | InvalidRangeError> {
    if (!TimeZone.isDay(day)) {
      return err(new InvalidDayError(day));
    }

    if (!Range.disjoint(ranges)) {
      return err(new InvalidRangeError(`shares no minute with another range of ${day}`));
    }

    return ok(new Exception({ day, ranges: [...ranges].sort((left, right) => left.startMinute - right.startMinute) }));
  }

  isOn(day: string): boolean {
    return this.props.day === day;
  }

  get day(): string {
    return this.props.day;
  }

  get ranges(): readonly Range[] {
    return this.props.ranges;
  }
}
