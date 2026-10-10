import { unwrap } from '@ddd-ts-kit/kernel';
import { Calendar } from '../../domain/aggregates/calendar.aggregate.js';
import { AppointmentType, type AppointmentTypeProps } from '../../domain/value-objects/appointment-type.vo.js';
import { BookingWindow } from '../../domain/value-objects/booking-window.vo.js';
import { Exception } from '../../domain/value-objects/exception.vo.js';
import { OpeningHours, type Weekday } from '../../domain/value-objects/opening-hours.vo.js';
import { Range } from '../../domain/value-objects/range.vo.js';
import { TimeOff } from '../../domain/value-objects/time-off.vo.js';
import { TimeZone } from '../../domain/value-objects/time-zone.vo.js';
import type { CalendarColumns, CalendarRow } from './calendar-row.schema.js';

type StoredRange = readonly [start: string, end: string];
type StoredWeek = Readonly<Record<Weekday, readonly StoredRange[]>>;
type StoredException = { readonly day: string; readonly ranges: readonly StoredRange[] };
type StoredTimeOff = { readonly startsAt: string; readonly endsAt: string };

export const CalendarMapper = {
  toDomain(row: CalendarRow): Calendar {
    const loaded = Calendar.rehydrate(row.id, {
      registeredAt: row.registered_at,
      practiceId: row.practice_id,
      practitionerId: row.practitioner_id,
      timeZone: unwrap(TimeZone.create(row.time_zone)),
      openingHours: openingHoursOf(JSON.parse(row.opening_hours) as StoredWeek),
      exceptions: (JSON.parse(row.exceptions) as StoredException[]).map(({ day, ranges }) => unwrap(Exception.create(day, ranges.map(rangeOf)))),
      timeOffs: (JSON.parse(row.time_offs) as StoredTimeOff[]).map(({ startsAt, endsAt }) => unwrap(TimeOff.create(new Date(startsAt), new Date(endsAt)))),
      appointmentTypes: (JSON.parse(row.appointment_types) as AppointmentTypeProps[]).map((facts) => unwrap(AppointmentType.create(facts))),
      bookingWindow: unwrap(BookingWindow.create(row.notice, row.horizon)),
      limit: row.patient_limit,
    });

    loaded.version = row.version;

    return loaded;
  },

  toRow(saved: Calendar): CalendarColumns {
    const state = saved.toState();

    return {
      id: saved.id,
      registered_at: state.registeredAt,
      practice_id: state.practiceId,
      practitioner_id: state.practitionerId,
      time_zone: state.timeZone.name,
      opening_hours: JSON.stringify(storedWeekOf(state.openingHours)),
      exceptions: JSON.stringify(state.exceptions.map(({ day, ranges }): StoredException => ({ day, ranges: ranges.map(storedRangeOf) }))),
      time_offs: JSON.stringify(state.timeOffs.map(({ startsAt, endsAt }): StoredTimeOff => ({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() }))),
      appointment_types: JSON.stringify(state.appointmentTypes),
      notice: state.bookingWindow.notice,
      horizon: state.bookingWindow.horizon,
      patient_limit: state.limit,
    };
  },
};

function rangeOf([start, end]: StoredRange): Range {
  return unwrap(Range.create(start, end));
}

function storedRangeOf(range: Range): StoredRange {
  return [range.start, range.end];
}

function openingHoursOf(week: StoredWeek): OpeningHours {
  return unwrap(
    OpeningHours.create({
      monday: week.monday.map(rangeOf),
      tuesday: week.tuesday.map(rangeOf),
      wednesday: week.wednesday.map(rangeOf),
      thursday: week.thursday.map(rangeOf),
      friday: week.friday.map(rangeOf),
      saturday: week.saturday.map(rangeOf),
      sunday: week.sunday.map(rangeOf),
    }),
  );
}

function storedWeekOf({ week }: OpeningHours): StoredWeek {
  return {
    monday: week.monday.map(storedRangeOf),
    tuesday: week.tuesday.map(storedRangeOf),
    wednesday: week.wednesday.map(storedRangeOf),
    thursday: week.thursday.map(storedRangeOf),
    friday: week.friday.map(storedRangeOf),
    saturday: week.saturday.map(storedRangeOf),
    sunday: week.sunday.map(storedRangeOf),
  };
}
