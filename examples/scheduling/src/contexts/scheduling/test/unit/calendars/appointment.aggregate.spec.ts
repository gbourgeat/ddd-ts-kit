import { describe, expect, it } from 'vitest';
import { given } from '@ddd-ts-kit/testing';
import { Appointment } from '@/contexts/scheduling/calendars/domain/aggregates/appointment.aggregate';
import { Cancellation } from '@/contexts/scheduling/calendars/domain/value-objects/cancellation.vo';
import { Slot } from '@/contexts/scheduling/calendars/domain/value-objects/slot.vo';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';

const bornAt = new Date('2026-03-01T00:00:00.000Z');
const deadline = new Date('2026-03-01T12:00:00.000Z');
const byPatient = Cancellation.create('patient');
const byPractice = Cancellation.create('practice', 'The practitioner is away.');

const ended = [
  ['cancelled', anAppointment().cancelledByPatient()],
  ['expired', anAppointment().expired()],
  ['completed', anAppointment().completed()],
  ['marked as a no-show', anAppointment().markedNoShow()],
] as const;

describe('Appointment', () => {
  it('is born with its identity', () => {
    const born = anAppointment().identifiedBy('appointment-7').bornAt(bornAt).build();

    expect(born.id).toBe('appointment-7');
    expect(born.registeredAt).toEqual(bornAt);
  });

  it('is rehydrated in its stored state without recording a new fact', () => {
    const stored = anAppointment().build();

    const loaded = Appointment.rehydrate(stored.id, stored.toState());

    expect(loaded.toState()).toEqual(stored.toState());
    expect(loaded.pullEvents()).toEqual([]);
  });

  it('records that it was booked, holding its slot with nothing left to confirm', () => {
    const template = anAppointment().build();

    const booked = Appointment.create('appointment-9', template.booking, bornAt);

    expect(booked.status).toBe('booked');
    expect(booked.confirmBefore).toBeUndefined();

    expect(booked.pullEvents()).toMatchObject([
      {
        name: 'scheduling.appointment.booked',
        aggregateId: 'appointment-9',
        occurredAt: bornAt,
        held: { booking: template.booking },
      },
    ]);
  });

  it('records that it was booked as a request, with the deadline of its confirmation', () => {
    const template = anAppointment().build();

    const requested = Appointment.request('appointment-9', template.booking, { now: bornAt, confirmBefore: deadline });

    expect(requested.status).toBe('requested');
    expect(requested.confirmBefore).toEqual(deadline);

    expect(requested.pullEvents()).toMatchObject([
      { name: 'scheduling.appointment.booked', held: { confirmBefore: deadline } },
    ]);
  });

  it('holds its slot, buffer included, while it is requested or booked', () => {
    const booked = anAppointment().startingAt(at('09:00')).lasting(30).withBuffer(10).build();
    const requested = anAppointment().startingAt(at('09:00')).lasting(30).requestedUntil(deadline).build();

    expect(booked.holds(Slot.between(at('09:35'), at('10:00'), at('10:00')))).toBe(true);
    expect(booked.holds(Slot.between(at('09:40'), at('10:00'), at('10:00')))).toBe(false);
    expect(requested.holds(Slot.between(at('09:15'), at('09:45'), at('09:45')))).toBe(true);
  });

  it.each(ended)('holds nothing once it is %s', (_end, builder) => {
    const appointment = builder.startingAt(at('09:00')).build();

    expect(appointment.isActive).toBe(false);
    expect(appointment.holds(appointment.slot)).toBe(false);
    expect(appointment.isHeldAfter(bornAt)).toBe(false);
  });

  it('is still to come for its patient until it starts', () => {
    const appointment = anAppointment().startingAt(at('09:00')).build();

    expect(appointment.isHeldAfter(at('08:59'))).toBe(true);
    expect(appointment.isHeldAfter(at('09:00'))).toBe(false);
  });
});

describe('Appointment, annotated by the staff', () => {
  it('records the internal note, and keeps it whatever its standing becomes', () => {
    given(anAppointment().requestedUntil(deadline))
      .when((appointment) => {
        appointment.annotate('Prefers the morning', at('07:00'));
        appointment.confirm(at('08:00'));
        appointment.cancel(byPractice, at('09:00'));
      })
      .thenEvents([
        {
          name: 'scheduling.appointment.annotated',
          occurredAt: at('07:00'),
          annotated: { internalNote: 'Prefers the morning', confirmBefore: deadline },
        },
        { name: 'scheduling.appointment.confirmed' },
        { name: 'scheduling.appointment.cancelled' },
      ])
      .thenState((appointment) => {
        expect(appointment.internalNote).toBe('Prefers the morning');
        expect(appointment.toState().internalNote).toBe('Prefers the morning');
      });
  });

  it('refuses a note on an appointment that has ended', () => {
    given(anAppointment().completed())
      .when((appointment) => appointment.annotate('Too late', at('08:00')))
      .thenError('APPOINTMENT_ENDED');
  });
});

describe('Appointment, from confirmation to its end', () => {
  it('is booked once its request is confirmed, and has no deadline any more', () => {
    given(anAppointment().requestedUntil(deadline))
      .when((appointment) => appointment.confirm(at('08:00')))
      .thenEvents([{ name: 'scheduling.appointment.confirmed', occurredAt: at('08:00') }])
      .thenState((appointment) => {
        expect(appointment.status).toBe('booked');
        expect(appointment.confirmBefore).toBeUndefined();
        expect(appointment.changedAt).toEqual(at('08:00'));
      });
  });

  it('refuses to confirm an appointment that is already booked', () => {
    given(anAppointment())
      .when((appointment) => appointment.confirm(at('08:00')))
      .thenError('APPOINTMENT_ALREADY_CONFIRMED');
  });

  it('is cancelled by its patient without a reason', () => {
    given(anAppointment())
      .when((appointment) => appointment.cancel(byPatient, at('08:00')))
      .thenEvents([
        { name: 'scheduling.appointment.cancelled', occurredAt: at('08:00'), ended: { cancellation: byPatient } },
      ])
      .thenState((appointment) => {
        expect(appointment.status).toBe('cancelled');
        expect(appointment.cancellation?.by).toBe('patient');
      });
  });

  it('is cancelled by the practice with the reason it gave, even after its start', () => {
    given(anAppointment().startingAt(at('09:00')))
      .when((appointment) => appointment.cancel(byPractice, at('09:10')))
      .thenEventNames(['scheduling.appointment.cancelled'])
      .thenState((appointment) => {
        expect(appointment.cancellation?.reason).toBe('The practitioner is away.');
      });
  });

  it('moves to another slot in one step, saying what it held before', () => {
    const next = Slot.between(at('14:00'), at('14:30'), at('14:40'));

    given(anAppointment().startingAt(at('09:00')).requestedUntil(deadline))
      .when((appointment) => appointment.reschedule(next, '2026-03-02', at('08:00')))
      .thenEventNames(['scheduling.appointment.rescheduled'])
      .thenState((appointment) => {
        expect(appointment.slot.equals(next)).toBe(true);
        expect(appointment.status).toBe('requested');
        expect(appointment.confirmBefore).toEqual(deadline);
      });
  });

  it('announces the slot it left when it is rescheduled', () => {
    const appointment = anAppointment().startingAt(at('09:00')).build();
    const previous = appointment.booking;

    appointment.pullEvents();

    appointment.reschedule(Slot.between(at('14:00'), at('14:30'), at('14:30')), '2026-03-02', at('08:00'));

    expect(appointment.pullEvents()).toMatchObject([{ moved: { booking: appointment.booking, previous } }]);
  });

  it('is completed once it has started', () => {
    given(anAppointment().startingAt(at('09:00')))
      .when((appointment) => appointment.complete(at('09:00')))
      .thenEvents([{ name: 'scheduling.appointment.completed', occurredAt: at('09:00') }])
      .thenState((appointment) => {
        expect(appointment.status).toBe('completed');
      });
  });

  it('refuses to be completed before its start', () => {
    given(anAppointment().startingAt(at('09:00')))
      .when((appointment) => appointment.complete(at('08:59')))
      .thenError('APPOINTMENT_NOT_STARTED');
  });

  it('is marked as a no-show once it has started', () => {
    given(anAppointment().startingAt(at('09:00')))
      .when((appointment) => appointment.markNoShow(at('09:20')))
      .thenEvents([{ name: 'scheduling.appointment.marked-no-show', occurredAt: at('09:20') }])
      .thenState((appointment) => {
        expect(appointment.status).toBe('no-show');
      });
  });

  it('refuses to be marked as a no-show before its start', () => {
    given(anAppointment().startingAt(at('09:00')))
      .when((appointment) => appointment.markNoShow(at('08:59')))
      .thenError('APPOINTMENT_NOT_STARTED');
  });
});

describe('Appointment, expiry and what follows an end', () => {
  it('expires at its deadline when nobody confirmed it', () => {
    given(anAppointment().requestedUntil(deadline))
      .when((appointment) => appointment.expire(deadline))
      .thenEvents([{ name: 'scheduling.appointment.expired', occurredAt: deadline }])
      .thenState((appointment) => {
        expect(appointment.status).toBe('expired');
        expect(appointment.confirmBefore).toBeUndefined();
      });
  });

  it('does not expire before its deadline', () => {
    given(anAppointment().requestedUntil(deadline))
      .when((appointment) => appointment.expire(new Date(deadline.getTime() - 1)))
      .thenNoEvent()
      .thenState((appointment) => {
        expect(appointment.status).toBe('requested');
      });
  });

  it('expires once: a second expiry of the same appointment changes nothing', () => {
    given(anAppointment().expired())
      .when((appointment) => appointment.expire(new Date('2026-03-05T00:00:00.000Z')))
      .thenNoEvent();
  });

  it('does not expire once it is confirmed', () => {
    given(anAppointment())
      .when((appointment) => appointment.expire(new Date('2026-03-05T00:00:00.000Z')))
      .thenNoEvent()
      .thenState((appointment) => {
        expect(appointment.status).toBe('booked');
      });
  });

  it.each(ended)('does not change once it is %s', (_end, builder) => {
    const now = new Date('2026-03-03T00:00:00.000Z');
    const elsewhere = Slot.between(at('14:00'), at('14:30'), at('14:30'));

    given(builder)
      .when((appointment) => appointment.confirm(now))
      .thenError('APPOINTMENT_ENDED');

    given(builder)
      .when((appointment) => appointment.cancel(byPatient, now))
      .thenError('APPOINTMENT_ENDED');

    given(builder)
      .when((appointment) => appointment.reschedule(elsewhere, '2026-03-02', now))
      .thenError('APPOINTMENT_ENDED');

    given(builder)
      .when((appointment) => appointment.complete(now))
      .thenError('APPOINTMENT_ENDED');

    given(builder)
      .when((appointment) => appointment.markNoShow(now))
      .thenError('APPOINTMENT_ENDED');
  });
});

function at(time: string): Date {
  return new Date(`2026-03-02T${time}:00.000Z`);
}
