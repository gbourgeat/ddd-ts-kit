import { ValueObject } from '@ddd-ts-kit/kernel';
import { InvalidDay } from '@/contexts/scheduling/domain/errors/invalid-day.error';
import { InvalidRange } from '@/contexts/scheduling/domain/errors/invalid-range.error';
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

  static create(day: string, ranges: readonly Range[]): Exception {
    if (!TimeZone.isDay(day)) {
      throw InvalidDay.forDay(day);
    }

    if (!Range.disjoint(ranges)) {
      throw InvalidRange.forRule(`shares no minute with another range of ${day}`);
    }

    return new Exception({ day, ranges: [...ranges].sort((left, right) => left.startMinute - right.startMinute) });
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
