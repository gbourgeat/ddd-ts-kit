import { Builder, sequence, type Defaults } from '@ddd-ts-kit/testing';
import { Calendar } from '@/contexts/scheduling/domain/aggregates/calendar.aggregate';
import {
  AppointmentType,
  type AppointmentTypeProps,
} from '@/contexts/scheduling/domain/value-objects/appointment-type.vo';
import { Exception } from '@/contexts/scheduling/domain/value-objects/exception.vo';
import { OpeningHours, type Weekday } from '@/contexts/scheduling/domain/value-objects/opening-hours.vo';
import { Range } from '@/contexts/scheduling/domain/value-objects/range.vo';
import { TimeOff } from '@/contexts/scheduling/domain/value-objects/time-off.vo';
import { TimeZone } from '@/contexts/scheduling/domain/value-objects/time-zone.vo';

type Hours = readonly (readonly [start: string, end: string])[];

interface CalendarIngredients {
  readonly id: string;
  readonly bornAt: Date;
  readonly practiceId: string;
  readonly practitionerId: string;
  readonly timeZone: string;
  readonly week: Partial<Record<Weekday, Hours>>;
  readonly exceptions: readonly (readonly [day: string, hours: Hours])[];
  readonly timeOffs: readonly (readonly [startsAt: Date, endsAt: Date])[];
  readonly appointmentTypes: readonly AppointmentTypeProps[];
}

const EVERY_DAY: readonly Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** A calendar of Europe/Paris, born closed and without any appointment type unless a test says otherwise. */
export class CalendarBuilder extends Builder<CalendarIngredients, Calendar> {
  identifiedBy(id: string): this {
    return this.with('id', id);
  }

  bornAt(instant: Date): this {
    return this.with('bornAt', instant);
  }

  ofPractitioner(practitionerId: string, practiceId: string): this {
    return this.with('practitionerId', practitionerId).with('practiceId', practiceId);
  }

  inTimeZone(timeZone: string): this {
    return this.with('timeZone', timeZone);
  }

  /** Open every day of the week on these ranges, each written as its two times `HH:MM`. */
  openEveryDay(...hours: Hours): this {
    return this.with('week', Object.fromEntries(EVERY_DAY.map((weekday) => [weekday, hours])));
  }

  /** A day whose hours replace the weekly ones; without any range the day is closed. */
  withException(day: string, ...hours: Hours): this {
    return this.adding('exceptions', [day, hours]);
  }

  off(startsAt: Date, endsAt: Date): this {
    return this.adding('timeOffs', [startsAt, endsAt]);
  }

  /** Offers a type of thirty minutes on a grid of thirty, without buffer nor confirmation, changed by what the test states. */
  offering(id: string, facts: Partial<Omit<AppointmentTypeProps, 'id'>> = {}): this {
    return this.adding('appointmentTypes', {
      id,
      name: id,
      duration: 30,
      grid: 30,
      buffer: 0,
      needsConfirmation: false,
      ...facts,
    });
  }

  protected defaults(): Defaults<CalendarIngredients> {
    return {
      id: sequence('calendar'),
      bornAt: new Date('2026-01-01T00:00:00.000Z'),
      practiceId: 'practice-1',
      practitionerId: 'practitioner-1',
      timeZone: 'Europe/Paris',
      week: {},
      exceptions: [],
      timeOffs: [],
      appointmentTypes: [],
    };
  }

  protected construct(ingredients: CalendarIngredients): Calendar {
    const { id, bornAt, practiceId, practitionerId } = ingredients;

    const built = Calendar.create(
      id,
      { practiceId, practitionerId, timeZone: TimeZone.create(ingredients.timeZone) },
      bornAt,
    );

    furnish(built, ingredients);
    built.pullEvents();

    return built;
  }
}

function furnish(built: Calendar, { bornAt, week, exceptions, timeOffs, appointmentTypes }: CalendarIngredients): void {
  if (Object.keys(week).length > 0) {
    built.setOpeningHours(
      OpeningHours.create(
        Object.fromEntries(Object.entries(week).map(([weekday, hours]) => [weekday, rangesOf(hours)])),
      ),
      bornAt,
    );
  }

  exceptions.forEach(([day, hours]) => built.addException(Exception.create(day, rangesOf(hours)), bornAt));
  timeOffs.forEach(([startsAt, endsAt]) => built.addTimeOff(TimeOff.create(startsAt, endsAt), [], bornAt));
  appointmentTypes.forEach((facts) => built.defineAppointmentType(AppointmentType.create(facts), bornAt));
}

function rangesOf(hours: Hours): readonly Range[] {
  return hours.map(([start, end]) => Range.create(start, end));
}

export function aCalendar(): CalendarBuilder {
  return new CalendarBuilder();
}
