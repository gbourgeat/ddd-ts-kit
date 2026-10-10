import { AggregateRoot, unwrap } from '@ddd-ts-kit/kernel';
import { BookingTooFarError } from '#src/contexts/scheduling/domain/errors/booking-too-far.error.js';
import { BookingTooLateError } from '#src/contexts/scheduling/domain/errors/booking-too-late.error.js';
import { OffGridError } from '#src/contexts/scheduling/domain/errors/off-grid.error.js';
import { OutsideAvailabilityError } from '#src/contexts/scheduling/domain/errors/outside-availability.error.js';
import { TimeOffOverAppointmentsError } from '#src/contexts/scheduling/domain/errors/time-off-over-appointments.error.js';
import { UnknownAppointmentTypeError } from '#src/contexts/scheduling/domain/errors/unknown-appointment-type.error.js';
import { CalendarAppointmentTypeDefined } from '#src/contexts/scheduling/domain/events/calendar-appointment-type-defined.event.js';
import { CalendarCreated } from '#src/contexts/scheduling/domain/events/calendar-created.event.js';
import { CalendarExceptionAdded } from '#src/contexts/scheduling/domain/events/calendar-exception-added.event.js';
import { CalendarOpeningHoursSet } from '#src/contexts/scheduling/domain/events/calendar-opening-hours-set.event.js';
import { CalendarTimeOffAdded } from '#src/contexts/scheduling/domain/events/calendar-time-off-added.event.js';
import type { AppointmentType } from '#src/contexts/scheduling/domain/value-objects/appointment-type.vo.js';
import { BookingWindow } from '#src/contexts/scheduling/domain/value-objects/booking-window.vo.js';
import type { Exception } from '#src/contexts/scheduling/domain/value-objects/exception.vo.js';
import { OpeningHours } from '#src/contexts/scheduling/domain/value-objects/opening-hours.vo.js';
import type { Range } from '#src/contexts/scheduling/domain/value-objects/range.vo.js';
import type { Slot } from '#src/contexts/scheduling/domain/value-objects/slot.vo.js';
import type { TimeOff } from '#src/contexts/scheduling/domain/value-objects/time-off.vo.js';
import type { TimeZone } from '#src/contexts/scheduling/domain/value-objects/time-zone.vo.js';
import { Waiter } from '#src/contexts/scheduling/domain/value-objects/waiter.vo.js';

export interface CalendarState {
  readonly registeredAt: Date;
  readonly practiceId: string;
  readonly practitionerId: string;
  readonly timeZone: TimeZone;
  readonly openingHours: OpeningHours;
  readonly exceptions: readonly Exception[];
  readonly timeOffs: readonly TimeOff[];
  readonly appointmentTypes: readonly AppointmentType[];
  readonly bookingWindow: BookingWindow;
  /** The number of future appointments a patient may hold with the practitioner. */
  readonly limit: number;
}

/** Whose calendar it is and where: the facts a calendar is born with. */
export interface CalendarDesk {
  readonly practiceId: string;
  readonly practitionerId: string;
  readonly timeZone: TimeZone;
}

const MINUTE = 60_000;
const DAY = 24 * 60;
const STANDARD_LIMIT = 3;
/** How long a requested appointment waits for its confirmation, in minutes. */
const CONFIRMATION_HOLD = 24 * 60;

export class Calendar extends AggregateRoot<string> {
  private constructor(
    id: string,
    private state: CalendarState,
  ) {
    super(id);
  }

  /** A calendar is born closed, without any appointment type, with the standard booking window and limit. */
  static create(id: string, desk: CalendarDesk, now: Date): Calendar {
    const created = new Calendar(id, {
      registeredAt: now,
      practiceId: desk.practiceId,
      practitionerId: desk.practitionerId,
      timeZone: desk.timeZone,
      openingHours: OpeningHours.closed(),
      exceptions: [],
      timeOffs: [],
      appointmentTypes: [],
      bookingWindow: BookingWindow.standard(),
      limit: STANDARD_LIMIT,
    });

    created.record(new CalendarCreated(id, now, desk.practiceId, desk.practitionerId, desk.timeZone.name));

    return created;
  }

  static rehydrate(id: string, state: CalendarState): Calendar {
    return new Calendar(id, state);
  }

  /** The weekly hours replace the previous ones. */
  setOpeningHours(openingHours: OpeningHours, now: Date): void {
    this.state = { ...this.state, openingHours };
    this.record(new CalendarOpeningHoursSet(this.id, now));
  }

  /** An exception replaces its day: the one the calendar already had for that day, and the weekly hours. */
  addException(exception: Exception, now: Date): void {
    const others = this.state.exceptions.filter((known) => !known.isOn(exception.day));

    this.state = { ...this.state, exceptions: [...others, exception] };
    this.record(new CalendarExceptionAdded(this.id, now, exception.day));
  }

  /** Refused when the period covers one of the slots the active appointments of the calendar hold. */
  addTimeOff(timeOff: TimeOff, held: readonly Slot[], now: Date): void {
    const covered = held.filter((slot) => timeOff.covers(slot.startsAt, slot.endsAt));

    if (covered.length > 0) {
      throw new TimeOffOverAppointmentsError(covered.length);
    }

    this.state = { ...this.state, timeOffs: [...this.state.timeOffs, timeOff] };
    this.record(new CalendarTimeOffAdded(this.id, now, timeOff.startsAt, timeOff.endsAt));
  }

  /** A type defined again under the same identifier replaces the previous one. */
  defineAppointmentType(appointmentType: AppointmentType, now: Date): void {
    const others = this.state.appointmentTypes.filter((known) => known.id !== appointmentType.id);

    this.state = { ...this.state, appointmentTypes: [...others, appointmentType] };
    this.record(new CalendarAppointmentTypeDefined(this.id, now, appointmentType.id));
  }

  /**
   * The slot an appointment of the type would hold from this start, when the calendar can take
   * it: inside the booking window, on the grid of the type, inside one opening range of its day
   * on the wall clock of the practice, and out of any time off.
   */
  slotFor(appointmentTypeId: string, startsAt: Date, now: Date): Slot {
    const appointmentType = this.typeOf(appointmentTypeId);
    const { bookingWindow, timeZone } = this.state;

    if (bookingWindow.isTooLate(startsAt, now)) {
      throw new BookingTooLateError(bookingWindow.notice);
    }

    if (bookingWindow.isTooFar(startsAt, now)) {
      throw new BookingTooFarError(bookingWindow.horizon);
    }

    if (startsAt.getTime() % MINUTE !== 0 || !appointmentType.startsOn(timeZone.minuteOf(startsAt))) {
      throw new OffGridError(appointmentType.grid);
    }

    const slot = appointmentType.slotAt(startsAt);

    if (!this.isOpenDuring(slot)) {
      throw new OutsideAvailabilityError(startsAt);
    }

    return slot;
  }

  /** When an appointment of the type requested now must be confirmed; nothing for a type that needs no confirmation. */
  confirmationDeadlineFor(appointmentTypeId: string, now: Date): Date | undefined {
    return this.typeOf(appointmentTypeId).needsConfirmation
      ? new Date(now.getTime() + CONFIRMATION_HOLD * MINUTE)
      : undefined;
  }

  /** The patient as a waiter for a type the calendar offers. */
  admit(patientId: string, appointmentTypeId: string, now: Date): Waiter {
    return unwrap(Waiter.create({ patientId, appointmentTypeId: this.typeOf(appointmentTypeId).id, joinedAt: now }));
  }

  /** The ranges the calendar is open on, a day `YYYY-MM-DD` of the practice: those of its exception, or the weekly ones. */
  rangesOn(day: string): readonly Range[] {
    const exception = this.state.exceptions.find((known) => known.isOn(day));

    return exception === undefined ? this.state.openingHours.rangesOn(day) : exception.ranges;
  }

  get registeredAt(): Date {
    return this.state.registeredAt;
  }

  get practiceId(): string {
    return this.state.practiceId;
  }

  get practitionerId(): string {
    return this.state.practitionerId;
  }

  get timeZone(): TimeZone {
    return this.state.timeZone;
  }

  get limit(): number {
    return this.state.limit;
  }

  get timeOffs(): readonly TimeOff[] {
    return this.state.timeOffs;
  }

  get appointmentTypes(): readonly AppointmentType[] {
    return this.state.appointmentTypes;
  }

  toState(): CalendarState {
    return { ...this.state };
  }

  private typeOf(appointmentTypeId: string): AppointmentType {
    const appointmentType = this.state.appointmentTypes.find((known) => known.id === appointmentTypeId);

    if (appointmentType === undefined) {
      throw new UnknownAppointmentTypeError(appointmentTypeId);
    }

    return appointmentType;
  }

  /** The appointment itself must fit: the buffer after it may run past the closing time. */
  private isOpenDuring(slot: Slot): boolean {
    const { timeZone, timeOffs } = this.state;
    const day = timeZone.dayOf(slot.startsAt);
    const start = timeZone.minuteOf(slot.startsAt);

    const end =
      timeZone.dayOf(slot.endsAt) === day ? timeZone.minuteOf(slot.endsAt) : DAY + timeZone.minuteOf(slot.endsAt);

    return (
      this.rangesOn(day).some((range) => range.contains(start, end)) &&
      !timeOffs.some((timeOff) => timeOff.covers(slot.startsAt, slot.endsAt))
    );
  }
}
