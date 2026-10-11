import { describe, expect, it } from 'vitest';
import { unwrap } from '@ddd-ts-kit/kernel';
import { given } from '@ddd-ts-kit/testing';
import { Calendar } from '@/contexts/scheduling/domain/aggregates/calendar.aggregate';
import { BookingTooFarError } from '@/contexts/scheduling/domain/errors/booking-too-far.error';
import { BookingTooLateError } from '@/contexts/scheduling/domain/errors/booking-too-late.error';
import { OffGridError } from '@/contexts/scheduling/domain/errors/off-grid.error';
import { OutsideAvailabilityError } from '@/contexts/scheduling/domain/errors/outside-availability.error';
import { TimeOffOverAppointmentsError } from '@/contexts/scheduling/domain/errors/time-off-over-appointments.error';
import { UnknownAppointmentTypeError } from '@/contexts/scheduling/domain/errors/unknown-appointment-type.error';
import { AppointmentType } from '@/contexts/scheduling/domain/value-objects/appointment-type.vo';
import { Exception } from '@/contexts/scheduling/domain/value-objects/exception.vo';
import { OpeningHours } from '@/contexts/scheduling/domain/value-objects/opening-hours.vo';
import { Range } from '@/contexts/scheduling/domain/value-objects/range.vo';
import { Slot } from '@/contexts/scheduling/domain/value-objects/slot.vo';
import { TimeOff } from '@/contexts/scheduling/domain/value-objects/time-off.vo';
import { TimeZone } from '@/contexts/scheduling/domain/value-objects/time-zone.vo';
import { aCalendar } from '@/contexts/scheduling/test/builders/calendar.builder';

const paris = unwrap(TimeZone.create('Europe/Paris'));
/** Long before every start of this spec and inside the horizon of all of them. */
const now = instant('2026-02-20T08:00:00.000Z');

describe('Calendar', () => {
  it('is born with its identity', () => {
    const bornAt = instant('2026-03-01T00:00:00.000Z');

    const born = aCalendar().identifiedBy('calendar-7').bornAt(bornAt).build();

    expect(born.id).toBe('calendar-7');
    expect(born.registeredAt).toEqual(bornAt);
  });

  it('is rehydrated in its stored state without recording a new fact', () => {
    const stored = open().build();

    const loaded = Calendar.rehydrate(stored.id, stored.toState());

    expect(loaded.toState()).toEqual(stored.toState());
    expect(loaded.pullEvents()).toEqual([]);
  });

  it('records the fact of its birth, with its practice, its practitioner and its time zone', () => {
    const born = Calendar.create(
      'calendar-1',
      { practiceId: 'practice-1', practitionerId: 'practitioner-1', timeZone: paris },
      now,
    );

    expect(born.pullEvents()).toEqual([
      {
        name: 'scheduling.calendar.created',
        aggregateId: 'calendar-1',
        occurredAt: now,
        practiceId: 'practice-1',
        practitionerId: 'practitioner-1',
        timeZone: 'Europe/Paris',
      },
    ]);
  });

  it('is born closed, in the time zone of its practice, with a limit of three future appointments per patient', () => {
    const born = aCalendar().ofPractitioner('practitioner-9', 'practice-4').inTimeZone('America/New_York').build();

    expect(born).toMatchObject({
      practiceId: 'practice-4',
      practitionerId: 'practitioner-9',
      limit: 3,
      appointmentTypes: [],
      timeOffs: [],
    });

    expect(born.timeZone.name).toBe('America/New_York');
    expect(born.rangesOn('2026-03-02')).toEqual([]);
  });

  it('is born with a notice of two hours and a horizon of ninety days', () => {
    const calendar = open().build();

    expect(() =>
      calendar.slotFor('consultation', instant('2026-03-02T09:00:00.000Z'), instant('2026-03-02T07:00:01.000Z')),
    ).toThrow(BookingTooLateError);

    expect(() =>
      calendar.slotFor('consultation', instant('2026-05-31T08:00:00.000Z'), instant('2026-03-02T07:59:00.000Z')),
    ).toThrow(BookingTooFarError);

    expect(
      calendar.slotFor('consultation', instant('2026-05-31T08:00:00.000Z'), instant('2026-03-02T08:00:00.000Z')),
    ).toBeInstanceOf(Slot);
  });
});

describe('Calendar, its availability', () => {
  it('replaces its weekly hours when opening hours are set', () => {
    given(open())
      .when((calendar) =>
        calendar.setOpeningHours(unwrap(OpeningHours.create({ monday: [range('10:00', '11:00')] })), now),
      )
      .thenEvents([{ name: 'scheduling.calendar.opening-hours-set' }])
      .thenState((calendar) => {
        expect(calendar.rangesOn('2026-03-02').map((hours) => [hours.start, hours.end])).toEqual([['10:00', '11:00']]);
        expect(calendar.rangesOn('2026-03-03')).toEqual([]);
      });
  });

  it('replaces the hours of a day by those of its exception, and leaves the other days', () => {
    given(open())
      .when((calendar) => calendar.addException(unwrap(Exception.create('2026-03-02', [range('20:00', '22:00')])), now))
      .thenEvents([{ name: 'scheduling.calendar.exception-added', day: '2026-03-02' }])
      .thenState((calendar) => {
        expect(calendar.rangesOn('2026-03-02').map((hours) => hours.start)).toEqual(['20:00']);
        expect(calendar.rangesOn('2026-03-03').map((hours) => hours.start)).toEqual(['09:00', '14:00']);
      });
  });

  it('keeps one exception per day: the last one added', () => {
    given(open().withException('2026-03-02', ['20:00', '22:00']))
      .when((calendar) => calendar.addException(unwrap(Exception.create('2026-03-02', [])), now))
      .thenState((calendar) => expect(calendar.rangesOn('2026-03-02')).toEqual([]));
  });

  it('adds a time off when no active appointment is held during it', () => {
    const startsAt = instant('2026-03-02T00:00:00.000Z');
    const endsAt = instant('2026-03-09T00:00:00.000Z');

    const before = Slot.between(
      instant('2026-03-01T23:30:00.000Z'),
      instant('2026-03-02T00:00:00.000Z'),
      instant('2026-03-02T00:10:00.000Z'),
    );

    given(open())
      .when((calendar) => calendar.addTimeOff(unwrap(TimeOff.create(startsAt, endsAt)), [before], now))
      .thenEvents([{ name: 'scheduling.calendar.time-off-added', startsAt, endsAt }])
      .thenState((calendar) => expect(calendar.timeOffs).toHaveLength(1));
  });

  it('refuses a time off that covers an active appointment', () => {
    const held = Slot.between(
      instant('2026-03-02T08:00:00.000Z'),
      instant('2026-03-02T08:30:00.000Z'),
      instant('2026-03-02T08:30:00.000Z'),
    );

    const timeOff = unwrap(TimeOff.create(instant('2026-03-02T08:15:00.000Z'), instant('2026-03-03T00:00:00.000Z')));

    given(open())
      .when((calendar) => calendar.addTimeOff(timeOff, [held], now))
      .thenError(TimeOffOverAppointmentsError, 'TIME_OFF_OVER_APPOINTMENTS')
      .thenState((calendar) => expect(calendar.timeOffs).toEqual([]));
  });

  it('offers an appointment type once defined, and replaces it when defined again under the same identifier', () => {
    const longer = unwrap(
      AppointmentType.create({
        id: 'consultation',
        name: 'Long consultation',
        duration: 60,
        grid: 30,
        buffer: 0,
        needsConfirmation: false,
      }),
    );

    given(open())
      .when((calendar) => calendar.defineAppointmentType(longer, now))
      .thenEvents([{ name: 'scheduling.calendar.appointment-type-defined', appointmentTypeId: 'consultation' }])
      .thenState((calendar) =>
        expect(calendar.appointmentTypes.map((type) => type.name)).toEqual(['Long consultation']),
      );
  });
});

describe('Calendar, the slot of an appointment', () => {
  it('is the duration of its type, then its buffer, from the start', () => {
    const calendar = open().offering('surgery', { duration: 45, grid: 15, buffer: 15 }).build();

    const slot = calendar.slotFor('surgery', instant('2026-03-02T08:15:00.000Z'), now);

    expect(
      slot.equals(
        Slot.between(
          instant('2026-03-02T08:15:00.000Z'),
          instant('2026-03-02T09:00:00.000Z'),
          instant('2026-03-02T09:15:00.000Z'),
        ),
      ),
    ).toBe(true);
  });

  it('is refused for a type the calendar does not offer', () => {
    expect(() => open().build().slotFor('surgery', instant('2026-03-02T08:00:00.000Z'), now)).toThrow(
      UnknownAppointmentTypeError,
    );
  });

  it.each([
    ['at the opening of the morning', '2026-03-02T08:00:00.000Z'],
    ['ending at the closing of the morning', '2026-03-02T10:30:00.000Z'],
    ['at the opening of the afternoon', '2026-03-02T13:00:00.000Z'],
  ])('is given %s', (_case, startsAt) => {
    expect(open().build().slotFor('consultation', instant(startsAt), now).startsAt).toEqual(instant(startsAt));
  });

  it.each([
    ['before the opening', '2026-03-02T07:30:00.000Z'],
    ['at the closing of the morning', '2026-03-02T11:00:00.000Z'],
    ['between the two ranges', '2026-03-02T12:00:00.000Z'],
    ['at night', '2026-03-02T22:00:00.000Z'],
  ])('is refused %s, outside the availability', (_case, startsAt) => {
    expect(() => open().build().slotFor('consultation', instant(startsAt), now)).toThrow(OutsideAvailabilityError);
  });

  it('must fit whole inside one range: an appointment does not span the lunch break', () => {
    const calendar = open().offering('surgery', { duration: 150, grid: 30 }).build();

    expect(() => calendar.slotFor('surgery', instant('2026-03-02T10:00:00.000Z'), now)).toThrow(
      OutsideAvailabilityError,
    );

    expect(calendar.slotFor('surgery', instant('2026-03-02T13:00:00.000Z'), now)).toBeInstanceOf(Slot);
  });

  it('may end at the closing time even when its buffer runs past it', () => {
    const calendar = open().offering('surgery', { duration: 30, grid: 30, buffer: 20 }).build();

    expect(calendar.slotFor('surgery', instant('2026-03-02T10:30:00.000Z'), now).heldUntil).toEqual(
      instant('2026-03-02T11:20:00.000Z'),
    );
  });

  it.each([
    ['a start between two steps of the grid', '2026-03-02T08:10:00.000Z'],
    ['a start that is not a whole minute', '2026-03-02T08:00:30.000Z'],
  ])('is refused for %s', (_case, startsAt) => {
    expect(() => open().build().slotFor('consultation', instant(startsAt), now)).toThrow(OffGridError);
  });

  it('counts the grid from midnight on the wall clock of the practice, not in UTC', () => {
    const calendar = aCalendar()
      .inTimeZone('Asia/Kolkata')
      .openEveryDay(['09:00', '18:00'])
      .offering('consultation', { grid: 60, duration: 60 })
      .build();

    expect(calendar.slotFor('consultation', instant('2026-03-02T04:30:00.000Z'), now)).toBeInstanceOf(Slot);
    expect(() => calendar.slotFor('consultation', instant('2026-03-02T05:00:00.000Z'), now)).toThrow(OffGridError);
  });

  it('follows the exception of its day: closed, or opened on other hours', () => {
    const calendar = open().withException('2026-03-02').withException('2026-03-03', ['20:00', '21:00']).build();

    expect(() => calendar.slotFor('consultation', instant('2026-03-02T08:00:00.000Z'), now)).toThrow(
      OutsideAvailabilityError,
    );

    expect(() => calendar.slotFor('consultation', instant('2026-03-03T08:00:00.000Z'), now)).toThrow(
      OutsideAvailabilityError,
    );

    expect(calendar.slotFor('consultation', instant('2026-03-03T19:00:00.000Z'), now)).toBeInstanceOf(Slot);
  });

  it('is refused during a time off, whatever the hours', () => {
    const calendar = open().off(instant('2026-03-02T08:15:00.000Z'), instant('2026-03-02T09:00:00.000Z')).build();

    expect(() => calendar.slotFor('consultation', instant('2026-03-02T08:00:00.000Z'), now)).toThrow(
      OutsideAvailabilityError,
    );

    expect(() => calendar.slotFor('consultation', instant('2026-03-02T08:30:00.000Z'), now)).toThrow(
      OutsideAvailabilityError,
    );

    expect(calendar.slotFor('consultation', instant('2026-03-02T09:00:00.000Z'), now)).toBeInstanceOf(Slot);
  });

  it('is refused closer to its start than the notice, and further than the horizon', () => {
    const calendar = open().build();
    const startsAt = instant('2026-03-02T08:00:00.000Z');

    expect(() => calendar.slotFor('consultation', startsAt, instant('2026-03-02T06:30:00.000Z'))).toThrow(
      BookingTooLateError,
    );

    expect(() => calendar.slotFor('consultation', startsAt, instant('2025-11-01T08:00:00.000Z'))).toThrow(
      BookingTooFarError,
    );

    expect(calendar.slotFor('consultation', startsAt, instant('2026-03-02T06:00:00.000Z'))).toBeInstanceOf(Slot);
  });
});

describe('Calendar, the confirmation of an appointment', () => {
  it('is due within a day for a type that needs one', () => {
    const calendar = open().offering('surgery', { needsConfirmation: true }).build();

    expect(calendar.confirmationDeadlineFor('surgery', now)).toEqual(instant('2026-02-21T08:00:00.000Z'));
  });

  it('is not asked for a type that needs none', () => {
    expect(open().build().confirmationDeadlineFor('consultation', now)).toBeUndefined();
  });

  it('is refused for a type the calendar does not offer', () => {
    expect(() => open().build().confirmationDeadlineFor('surgery', now)).toThrow(UnknownAppointmentTypeError);
  });
});

/** Open 09:00 to 12:00 and 14:00 to 18:00 on the wall clock of Paris, offering a consultation of thirty minutes on a grid of thirty. */
function open() {
  return aCalendar().openEveryDay(['09:00', '12:00'], ['14:00', '18:00']).offering('consultation');
}

function instant(text: string): Date {
  return new Date(text);
}

function range(start: string, end: string): Range {
  return unwrap(Range.create(start, end));
}
