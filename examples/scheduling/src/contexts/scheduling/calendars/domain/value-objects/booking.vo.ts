import { ValueObject } from '@ddd-ts-kit/kernel';
import { InvalidBooking } from '@/contexts/scheduling/calendars/domain/errors/invalid-booking.error';
import type { Slot } from '@/contexts/scheduling/calendars/domain/value-objects/slot.vo';

export type BookingProps = {
  readonly calendarId: string;
  readonly practiceId: string;
  readonly practitionerId: string;
  readonly patientId: string;
  readonly appointmentTypeId: string;
  readonly slot: Slot;
  /** The date of the start in the time zone of the practice, `YYYY-MM-DD`. */
  readonly day: string;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const NAMED = [
  ['calendarId', 'names its calendar'],
  ['practiceId', 'names its practice'],
  ['practitionerId', 'names its practitioner'],
  ['patientId', 'names its patient'],
  ['appointmentTypeId', 'names its appointment type'],
] as const;

export class Booking extends ValueObject<BookingProps> {
  private constructor(props: BookingProps) {
    super(props);
  }

  static create(props: BookingProps): Booking {
    const unnamed = NAMED.find(([field]) => props[field].trim().length === 0);

    if (unnamed !== undefined) {
      throw InvalidBooking.forRule(unnamed[1]);
    }

    if (!DAY.test(props.day)) {
      throw InvalidBooking.forRule('gives its day as a calendar date');
    }

    return new Booking(props);
  }

  /** The same booking on another slot of the same calendar. */
  movedTo(slot: Slot, day: string): Booking {
    return Booking.create({ ...this.props, slot, day });
  }

  get calendarId(): string {
    return this.props.calendarId;
  }

  get practiceId(): string {
    return this.props.practiceId;
  }

  get practitionerId(): string {
    return this.props.practitionerId;
  }

  get patientId(): string {
    return this.props.patientId;
  }

  get appointmentTypeId(): string {
    return this.props.appointmentTypeId;
  }

  get slot(): Slot {
    return this.props.slot;
  }

  get day(): string {
    return this.props.day;
  }
}
