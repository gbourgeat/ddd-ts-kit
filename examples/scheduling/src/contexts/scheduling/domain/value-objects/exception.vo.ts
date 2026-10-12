import { ValueObject, err, ok, type Result } from '@ddd-ts-kit/kernel';
import { CalendarError } from '@/contexts/scheduling/domain/errors/calendar.error';
import { Range } from '@/contexts/scheduling/domain/value-objects/range.vo';
import { TimeZone } from '@/contexts/scheduling/domain/value-objects/time-zone.vo';

export type ExceptionProps = {
  readonly day: string;
  readonly ranges: readonly Range[];
};

/** A day whose hours replace the weekly ones: closed when it has no range, opened on its ranges otherwise. */
export class Exception extends ValueObject<ExceptionProps> {
  private constructor(props: ExceptionProps) {
    super(props);
  }

  static create(day: string, ranges: readonly Range[]): Result<Exception, CalendarError> {
    if (!TimeZone.isDay(day)) {
      return err(CalendarError.invalidDay(day));
    }

    if (!Range.disjoint(ranges)) {
      return err(CalendarError.invalidRange(`shares no minute with another range of ${day}`));
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
