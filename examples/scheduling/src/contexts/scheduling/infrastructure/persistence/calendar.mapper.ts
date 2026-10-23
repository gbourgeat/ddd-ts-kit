import { Calendar } from '@/contexts/scheduling/domain/calendars/aggregates/calendar.aggregate';
import {
  AppointmentType,
  type AppointmentTypeProps,
} from '@/contexts/scheduling/domain/calendars/value-objects/appointment-type.vo';
import { BookingWindow } from '@/contexts/scheduling/domain/calendars/value-objects/booking-window.vo';
import { Exception } from '@/contexts/scheduling/domain/calendars/value-objects/exception.vo';
import { OpeningHours } from '@/contexts/scheduling/domain/calendars/value-objects/opening-hours.vo';
import type { Weekday } from '@/contexts/scheduling/domain/calendars/vocabularies/weekday.vocabulary';
import { Range } from '@/contexts/scheduling/domain/calendars/value-objects/range.vo';
import { TimeOff } from '@/contexts/scheduling/domain/calendars/value-objects/time-off.vo';
import { TimeZone } from '@/contexts/scheduling/domain/calendars/value-objects/time-zone.vo';
import type {
  CalendarColumns,
  CalendarRow,
} from '@/contexts/scheduling/infrastructure/persistence/calendar-row.schema';

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
      timeZone: TimeZone.create(row.time_zone),
      openingHours: openingHoursOf(JSON.parse(row.opening_hours) as StoredWeek),
      exceptions: (JSON.parse(row.exceptions) as StoredException[]).map(({ day, ranges }) =>
        Exception.create(day, ranges.map(rangeOf)),
      ),
      timeOffs: (JSON.parse(row.time_offs) as StoredTimeOff[]).map(({ startsAt, endsAt }) =>
        TimeOff.create(new Date(startsAt), new Date(endsAt)),
      ),
      appointmentTypes: (JSON.parse(row.appointment_types) as AppointmentTypeProps[]).map((facts) =>
        AppointmentType.create(facts),
      ),
      bookingWindow: BookingWindow.create(row.notice, row.horizon),
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
      exceptions: JSON.stringify(
        state.exceptions.map(({ day, ranges }): StoredException => ({ day, ranges: ranges.map(storedRangeOf) })),
      ),
      time_offs: JSON.stringify(
        state.timeOffs.map(
          ({ startsAt, endsAt }): StoredTimeOff => ({
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
          }),
        ),
      ),
      appointment_types: JSON.stringify(state.appointmentTypes),
      notice: state.bookingWindow.notice,
      horizon: state.bookingWindow.horizon,
      patient_limit: state.limit,
    };
  },
};

function rangeOf([start, end]: StoredRange): Range {
  return Range.create(start, end);
}

function storedRangeOf(range: Range): StoredRange {
  return [range.start, range.end];
}

function openingHoursOf(week: StoredWeek): OpeningHours {
  return OpeningHours.create({
    monday: week.monday.map(rangeOf),
    tuesday: week.tuesday.map(rangeOf),
    wednesday: week.wednesday.map(rangeOf),
    thursday: week.thursday.map(rangeOf),
    friday: week.friday.map(rangeOf),
    saturday: week.saturday.map(rangeOf),
    sunday: week.sunday.map(rangeOf),
  });
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
