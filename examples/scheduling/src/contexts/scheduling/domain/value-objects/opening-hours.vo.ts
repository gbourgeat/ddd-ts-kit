import { ValueObject } from '@ddd-ts-kit/kernel';
import { InvalidRange } from '@/contexts/scheduling/domain/errors/invalid-range.error';
import { Range } from '@/contexts/scheduling/domain/value-objects/range.vo';
import { Weekday } from '@/contexts/scheduling/domain/vocabularies/weekday.vocabulary';

export type OpeningHoursProps = {
  readonly week: Readonly<Record<Weekday, readonly Range[]>>;
};

const WEEK: readonly Weekday[] = [
  Weekday.Sunday,
  Weekday.Monday,
  Weekday.Tuesday,
  Weekday.Wednesday,
  Weekday.Thursday,
  Weekday.Friday,
  Weekday.Saturday,
];

/** The weekly ranges, in the wall-clock time of the practice, during which a calendar takes appointments. */
export class OpeningHours extends ValueObject<OpeningHoursProps> {
  private constructor(props: OpeningHoursProps) {
    super(props);
  }

  /** The ranges of each weekday; a day left out is closed. The ranges of one day share no minute. */
  static create(week: Partial<Record<Weekday, readonly Range[]>>): OpeningHours {
    const whole = wholeWeek((weekday) => sorted(week[weekday] ?? []));
    const crowded = WEEK.find((weekday) => !Range.disjoint(whole[weekday]));

    if (crowded === undefined) {
      return new OpeningHours({ week: whole });
    }

    throw InvalidRange.forRule(`shares no minute with another range of ${crowded}`);
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
    monday: rangesOf(Weekday.Monday),
    tuesday: rangesOf(Weekday.Tuesday),
    wednesday: rangesOf(Weekday.Wednesday),
    thursday: rangesOf(Weekday.Thursday),
    friday: rangesOf(Weekday.Friday),
    saturday: rangesOf(Weekday.Saturday),
    sunday: rangesOf(Weekday.Sunday),
  };
}
