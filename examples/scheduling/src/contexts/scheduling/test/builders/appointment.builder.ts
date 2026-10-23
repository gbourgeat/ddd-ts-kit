import { Builder, sequence, type Defaults } from '@ddd-ts-kit/testing';
import { Appointment } from '@/contexts/scheduling/calendars/domain/aggregates/appointment.aggregate';
import { Booking } from '@/contexts/scheduling/calendars/domain/value-objects/booking.vo';
import { Cancellation } from '@/contexts/scheduling/calendars/domain/value-objects/cancellation.vo';
import { Slot } from '@/contexts/scheduling/calendars/domain/value-objects/slot.vo';

const MINUTE = 60_000;

interface AppointmentIngredients {
  readonly id: string;
  readonly bornAt: Date;
  readonly calendarId: string;
  readonly practiceId: string;
  readonly practitionerId: string;
  readonly patientId: string;
  readonly appointmentTypeId: string;
  readonly startsAt: Date;
  readonly minutes: number;
  readonly bufferMinutes: number;
  /** Left out: the date of the start in UTC. */
  readonly day: string | undefined;
  readonly confirmBefore: Date | undefined;
  readonly end: 'none' | 'cancelled-by-patient' | 'cancelled-by-practice' | 'expired' | 'completed' | 'no-show';
}

export class AppointmentBuilder extends Builder<AppointmentIngredients, Appointment> {
  identifiedBy(id: string): this {
    return this.with('id', id);
  }

  bornAt(instant: Date): this {
    return this.with('bornAt', instant);
  }

  onCalendar(calendarId: string): this {
    return this.with('calendarId', calendarId);
  }

  inPractice(practiceId: string): this {
    return this.with('practiceId', practiceId);
  }

  withPractitioner(practitionerId: string): this {
    return this.with('practitionerId', practitionerId);
  }

  forPatient(patientId: string): this {
    return this.with('patientId', patientId);
  }

  ofType(appointmentTypeId: string): this {
    return this.with('appointmentTypeId', appointmentTypeId);
  }

  startingAt(instant: Date): this {
    return this.with('startsAt', instant);
  }

  lasting(minutes: number): this {
    return this.with('minutes', minutes);
  }

  withBuffer(minutes: number): this {
    return this.with('bufferMinutes', minutes);
  }

  onDay(day: string): this {
    return this.with('day', day);
  }

  /** Requested and still unconfirmed, to confirm before that instant. */
  requestedUntil(deadline: Date): this {
    return this.with('confirmBefore', deadline);
  }

  cancelledByPatient(): this {
    return this.with('end', 'cancelled-by-patient');
  }

  cancelledByPractice(): this {
    return this.with('end', 'cancelled-by-practice');
  }

  /** Requested, then expired at its deadline (one hour after its birth unless `requestedUntil` says otherwise). */
  expired(): this {
    return this.with('end', 'expired');
  }

  completed(): this {
    return this.with('end', 'completed');
  }

  markedNoShow(): this {
    return this.with('end', 'no-show');
  }

  protected defaults(): Defaults<AppointmentIngredients> {
    return {
      id: sequence('appointment'),
      bornAt: new Date('2026-01-01T00:00:00.000Z'),
      calendarId: sequence('calendar'),
      practiceId: 'practice-1',
      practitionerId: 'practitioner-1',
      patientId: 'patient-1',
      appointmentTypeId: 'consultation',
      startsAt: new Date('2026-03-02T09:00:00.000Z'),
      minutes: 30,
      bufferMinutes: 0,
      day: undefined,
      confirmBefore: undefined,
      end: 'none',
    };
  }

  protected construct(ingredients: AppointmentIngredients): Appointment {
    const born = bornFrom(ingredients);

    ENDINGS[ingredients.end](born, ingredients);

    return born;
  }
}

function bornFrom(ingredients: AppointmentIngredients): Appointment {
  const { id, bornAt, startsAt } = ingredients;
  const endsAt = new Date(startsAt.getTime() + ingredients.minutes * MINUTE);
  const slot = Slot.between(startsAt, endsAt, new Date(endsAt.getTime() + ingredients.bufferMinutes * MINUTE));

  const booking = Booking.create({
    calendarId: ingredients.calendarId,
    practiceId: ingredients.practiceId,
    practitionerId: ingredients.practitionerId,
    patientId: ingredients.patientId,
    appointmentTypeId: ingredients.appointmentTypeId,
    slot,
    day: ingredients.day ?? startsAt.toISOString().slice(0, 10),
  });

  const confirmBefore =
    ingredients.confirmBefore ?? (ingredients.end === 'expired' ? new Date(bornAt.getTime() + 60 * MINUTE) : undefined);

  return confirmBefore === undefined
    ? Appointment.create(id, booking, bornAt)
    : Appointment.request(id, booking, { now: bornAt, confirmBefore });
}

/** Each end is reached through the public API, at the earliest instant the rules allow. */
const ENDINGS: Record<AppointmentIngredients['end'], (born: Appointment, ingredients: AppointmentIngredients) => void> =
  {
    none: () => undefined,
    'cancelled-by-patient': (born, { bornAt }) => born.cancel(Cancellation.create('patient'), bornAt),
    'cancelled-by-practice': (born, { bornAt }) =>
      born.cancel(Cancellation.create('practice', 'The practitioner is away.'), bornAt),
    expired: (born) => born.expire(born.confirmBefore ?? born.registeredAt),
    completed: (born, { startsAt }) => born.complete(startsAt),
    'no-show': (born, { startsAt }) => born.markNoShow(startsAt),
  };

export function anAppointment(): AppointmentBuilder {
  return new AppointmentBuilder();
}
