import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import { platformTestModule } from '@/platform/platform-test.module';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { Agenda } from '@/contexts/scheduling/application/ports/agenda.port';
import { SchedulingRelationships } from '@/contexts/scheduling/application/ports/scheduling-relationships.port';
import { AgendaProjection } from '@/contexts/scheduling/application/projections/agenda.projection';
import { AppointmentAnnotated } from '@/contexts/scheduling/domain/events/appointment-annotated.event';
import { AppointmentBooked } from '@/contexts/scheduling/domain/events/appointment-booked.event';
import { AppointmentCancelled } from '@/contexts/scheduling/domain/events/appointment-cancelled.event';
import { AppointmentExpired } from '@/contexts/scheduling/domain/events/appointment-expired.event';
import { AppointmentRescheduled } from '@/contexts/scheduling/domain/events/appointment-rescheduled.event';
import { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';
import { CalendarRepository } from '@/contexts/scheduling/domain/repositories/calendar.repository';
import { WaitlistRepository } from '@/contexts/scheduling/domain/repositories/waitlist.repository';
import { Cancellation } from '@/contexts/scheduling/domain/value-objects/cancellation.vo';
import { Slot } from '@/contexts/scheduling/domain/value-objects/slot.vo';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';
import { aCalendar } from '@/contexts/scheduling/test/builders/calendar.builder';
import { FakeAgenda } from '@/contexts/scheduling/test/fakes/agenda.fake';
import { FakeAppointmentRepository } from '@/contexts/scheduling/test/fakes/appointment.repository.fake';
import { FakeWaitlistRepository } from '@/contexts/scheduling/test/fakes/waitlist.repository.fake';
import { FakeSchedulingRelationships } from '@/contexts/scheduling/test/fakes/scheduling-relationships.fake';

// The use cases of the context ask `Access`, and a freed slot is offered to the waitlist by the context itself.
const authorization = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: { system: [schedulingPermissions['waitlist.offer'], schedulingPermissions['attendance.note']] },
    systemRole: 'system',
  }),
});

// A freed slot is offered to the waitlist of its calendar: every calendar exists here, and nobody waits.
const calendars = { findById: async (id: string) => aCalendar().identifiedBy(id).build(), save: async () => undefined };
const bornAt = new Date('2026-03-01T08:00:00.000Z');

describe('The agenda, kept from the facts of the appointments', () => {
  it('shows a booked appointment with everything it holds', async () => {
    const { appointments, agenda } = arrange();

    await appointments.save(planned().build());

    expect(await agenda.get('appointment-1')).toEqual({
      id: 'appointment-1',
      calendarId: 'calendar-4',
      practiceId: 'practice-2',
      practitionerId: 'practitioner-3',
      patientId: 'patient-5',
      appointmentTypeId: 'consultation',
      startsAt: at('09:00'),
      endsAt: at('09:30'),
      heldUntil: at('09:40'),
      day: '2026-03-02',
      status: 'booked',
      confirmBefore: null,
      cancelledBy: null,
      internalNote: null,
      changedAt: bornAt,
    });
  });

  it('shows a requested appointment with the deadline of its confirmation', async () => {
    const { appointments, agenda } = arrange();

    await appointments.save(planned().requestedUntil(at('08:00')).build());

    expect(await agenda.get('appointment-1')).toMatchObject({ status: 'requested', confirmBefore: at('08:00') });
  });

  it('shows a confirmed appointment as booked, without a deadline', async () => {
    const { appointments, agenda } = arrange();
    const appointment = planned().requestedUntil(at('08:00')).build();

    await appointments.save(appointment);

    appointment.confirm(at('07:00'));
    await appointments.save(appointment);

    expect(await agenda.get('appointment-1')).toMatchObject({
      status: 'booked',
      confirmBefore: null,
      changedAt: at('07:00'),
    });
  });

  it('moves a rescheduled appointment and keeps where it stands', async () => {
    const { appointments, agenda } = arrange();
    const appointment = planned().requestedUntil(at('08:00')).build();

    await appointments.save(appointment);

    appointment.reschedule(
      Slot.between(
        new Date('2026-03-03T23:30:00.000Z'),
        new Date('2026-03-04T00:00:00.000Z'),
        new Date('2026-03-04T00:10:00.000Z'),
      ),
      '2026-03-04',
      at('07:00'),
    );

    await appointments.save(appointment);

    expect(await agenda.get('appointment-1')).toMatchObject({
      startsAt: new Date('2026-03-03T23:30:00.000Z'),
      endsAt: new Date('2026-03-04T00:00:00.000Z'),
      heldUntil: new Date('2026-03-04T00:10:00.000Z'),
      day: '2026-03-04',
      status: 'requested',
      confirmBefore: at('08:00'),
      changedAt: at('07:00'),
    });
  });

  it('shows the internal note of the staff, and keeps it when the appointment changes its standing', async () => {
    const { appointments, agenda } = arrange();
    const appointment = planned().requestedUntil(at('08:00')).build();

    appointment.annotate('Prefers the morning', bornAt);
    await appointments.save(appointment);

    appointment.confirm(at('07:00'));
    await appointments.save(appointment);

    expect(await agenda.get('appointment-1')).toMatchObject({ status: 'booked', internalNote: 'Prefers the morning' });
  });

  it('shows who cancelled an appointment, and keeps it in the agenda', async () => {
    const { appointments, agenda } = arrange();
    const appointment = planned().build();

    await appointments.save(appointment);

    appointment.cancel(Cancellation.create('practice', 'The practitioner is away.'), at('07:00'));
    await appointments.save(appointment);

    expect(await agenda.get('appointment-1')).toMatchObject({
      status: 'cancelled',
      cancelledBy: 'practice',
      changedAt: at('07:00'),
    });
  });

  it.each([
    ['expired', planned().expired(), { status: 'expired', confirmBefore: null }],
    ['completed', planned().completed(), { status: 'completed' }],
    ['marked as a no-show', planned().markedNoShow(), { status: 'no-show' }],
  ])('shows an appointment that was %s', async (_end, builder, expected) => {
    const { appointments, agenda } = arrange();

    await appointments.save(builder.build());

    expect(await agenda.get('appointment-1')).toMatchObject(expected);
  });
});

describe('The agenda, given facts twice or out of order', () => {
  it('ends on the same entry when a fact is applied twice', async () => {
    const agenda = new FakeAgenda();
    const projection = new AgendaProjection(agenda);
    const { booking } = planned().build();
    const booked = new AppointmentBooked('appointment-1', bornAt, { booking });

    const cancelled = new AppointmentCancelled('appointment-1', at('07:00'), {
      booking,
      cancellation: Cancellation.create('patient'),
    });

    const writes = [
      await projection.booked(booked),
      await projection.cancelled(cancelled),
      await projection.booked(booked),
      await projection.cancelled(cancelled),
    ];

    expect(writes).toEqual(['applied', 'applied', 'stale', 'stale']);
    expect(await agenda.get('appointment-1')).toMatchObject({ status: 'cancelled', cancelledBy: 'patient' });
  });

  it('takes the end of an appointment for its last word when it comes in the same millisecond as its booking, whatever the order', async () => {
    const agenda = new FakeAgenda();
    const projection = new AgendaProjection(agenda);
    const { booking } = planned().build();
    const expired = new AppointmentExpired('appointment-1', bornAt, booking);

    const writes = [
      await projection.expired(expired),
      await projection.booked(new AppointmentBooked('appointment-1', bornAt, { booking })),
    ];

    expect(writes).toEqual(['applied', 'stale']);
    expect(await agenda.get('appointment-1')).toMatchObject({ status: 'expired' });
  });

  it('keeps the note met before the booking of the same instant, whatever the order', async () => {
    const agenda = new FakeAgenda();
    const projection = new AgendaProjection(agenda);
    const { booking } = planned().build();
    const note = { internalNote: 'Prefers the morning', booking, confirmBefore: at('08:00') };

    const writes = [
      await projection.annotated(new AppointmentAnnotated('appointment-1', bornAt, note)),
      await projection.booked(new AppointmentBooked('appointment-1', bornAt, { booking, confirmBefore: at('08:00') })),
    ];

    expect(writes).toEqual(['applied', 'stale']);

    expect(await agenda.get('appointment-1')).toMatchObject({
      status: 'requested',
      confirmBefore: at('08:00'),
      calendarId: 'calendar-4',
      internalNote: 'Prefers the morning',
    });
  });

  it('ignores the move of an appointment it never saw', async () => {
    const agenda = new FakeAgenda();
    const projection = new AgendaProjection(agenda);
    const { booking } = planned().build();

    const write = await projection.rescheduled(
      new AppointmentRescheduled('appointment-1', at('07:00'), { booking, previous: booking }),
    );

    expect(write).toBe('ignored');
    expect(await agenda.get('appointment-1')).toBeUndefined();
  });
});

function arrange() {
  const agenda = new FakeAgenda();

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('scheduling', schedulingDeclarations), authorization],
    fakes: [
      fake(Agenda, agenda),
      fake(AppointmentRepository, new FakeAppointmentRepository()),
      fake(SchedulingRelationships, new FakeSchedulingRelationships()),
      fake(CalendarRepository, calendars),
      fake(WaitlistRepository, new FakeWaitlistRepository()),
    ],
  });

  return { appointments: application.get(AppointmentRepository), agenda };
}

function at(time: string): Date {
  return new Date(`2026-03-02T${time}:00.000Z`);
}

function planned() {
  return anAppointment()
    .identifiedBy('appointment-1')
    .bornAt(bornAt)
    .onCalendar('calendar-4')
    .inPractice('practice-2')
    .withPractitioner('practitioner-3')
    .forPatient('patient-5')
    .startingAt(at('09:00'))
    .lasting(30)
    .withBuffer(10);
}
