import { ValueObject, err, ok, type Result } from '@ddd-ts-kit/kernel';
import { CalendarError } from '@/contexts/scheduling/domain/errors/calendar.error';
import { Range } from '@/contexts/scheduling/domain/value-objects/range.vo';

export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type OpeningHoursProps = {
  readonly week: Readonly<Record<Weekday, readonly Range[]>>;
};

const WEEK: readonly Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** The weekly ranges, in the wall-clock time of the practice, during which a calendar takes appointments. */
export class OpeningHours extends ValueObject<OpeningHoursProps> {
  private constructor(props: OpeningHoursProps) {
    super(props);
  }

  /** The ranges of each weekday; a day left out is closed. The ranges of one day share no minute. */
  static create(week: Partial<Record<Weekday, readonly Range[]>>): Result<OpeningHours, CalendarError> {
    const whole = wholeWeek((weekday) => sorted(week[weekday] ?? []));
    const crowded = WEEK.find((weekday) => !Range.disjoint(whole[weekday]));

    return crowded === undefined
      ? ok(new OpeningHours({ week: whole }))
      : err(CalendarError.invalidRange(`shares no minute with another range of ${crowded}`));
  }

  /** Hours that open nothing: what a calendar has before its hours are set. */
  static closed(): OpeningHours {
    return new OpeningHours({ week: wholeWeek(() => []) });
  }

  /** The ranges of the weekday a day `YYYY-MM-DD` falls on. */
  rangesOn(day: string): readonly Range[] {
    const weekday = WEEK[new Date(`${day}T00:00:00.000Z`).getUTCDay()];

    return weekday === undefined ? [] : this.props.week[weekday];
  }

  get week(): Readonly<Record<Weekday, readonly Range[]>> {
    return this.props.week;
  }
}

function sorted(ranges: readonly Range[]): readonly Range[] {
  return [...ranges].sort((left, right) => left.startMinute - right.startMinute);
}

function wholeWeek(rangesOf: (weekday: Weekday) => readonly Range[]): Record<Weekday, readonly Range[]> {
  return {
    monday: rangesOf('monday'),
    tuesday: rangesOf('tuesday'),
    wednesday: rangesOf('wednesday'),
    thursday: rangesOf('thursday'),
    friday: rangesOf('friday'),
    saturday: rangesOf('saturday'),
    sunday: rangesOf('sunday'),
  };
}
