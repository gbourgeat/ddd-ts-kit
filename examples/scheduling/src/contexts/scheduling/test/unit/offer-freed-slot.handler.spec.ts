import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { AllowAll, anActor } from '@ddd-ts-kit/auth/testing';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { OfferFreedSlotCommand } from '@/contexts/scheduling/application/waitlist/commands/offer-freed-slot/offer-freed-slot.command';
import { AppointmentRepository } from '@/contexts/scheduling/domain/calendars/repositories/appointment.repository';
import { Cancellation } from '@/contexts/scheduling/domain/calendars/value-objects/cancellation.vo';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';
import { aCalendar } from '@/contexts/scheduling/test/builders/calendar.builder';
import { aWaitlist } from '@/contexts/scheduling/test/builders/waitlist.builder';
import { aSchedulingWorld } from '@/contexts/scheduling/test/worlds/scheduling.world';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { holder: [schedulingPermissions['waitlist.offer']] } }),
});

const holder = anActor().withRole('holder').build();
/** Friday 27 February 2026, 11:00 in Paris: the test clock. The slots are on Monday 2 March. */
const now = new Date('2026-02-27T10:00:00.000Z');
const nine = { startsAt: paris('09:00'), endsAt: paris('09:30'), heldUntil: paris('09:30') };

describe('Offer freed slot', () => {
  it('requests the freed slot for the first waiter, held thirty minutes, and answers the identifier of the appointment', async () => {
    const { application, appointmentRepository } = await arrange();

    const id = await application.commandBus.execute(new OfferFreedSlotCommand(holder, 'calendar-1', nine));

    const requested = await appointmentRepository.findById('appointment-1');

    expect(id).toBe('appointment-1');

    expect(requested).toMatchObject({
      status: 'requested',
      patientId: 'patient-1',
      calendarId: 'calendar-1',
      confirmBefore: new Date('2026-02-27T10:30:00.000Z'),
    });

    expect(requested?.booking).toMatchObject({
      practiceId: 'practice-1',
      practitionerId: 'practitioner-1',
      appointmentTypeId: 'consultation',
      day: '2026-03-02',
    });

    expect(requested?.slot).toMatchObject(nine);
  });

  it('is refused to an actor who does not hold the permission waitlist.offer', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new OfferFreedSlotCommand(anActor().build(), 'calendar-1', nine)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('takes the waiter off the waitlist with the offer', async () => {
    const { application, waitlistRepository } = await arrange();

    await application.commandBus.execute(new OfferFreedSlotCommand(holder, 'calendar-1', nine));

    expect(
      (await waitlistRepository.findById('calendar-1.2026-03-02'))?.waiters.map((waiter) => waiter.patientId),
    ).toEqual(['patient-2']);
  });

  it('announces the offer and the appointment it requests, to the context and to the others', async () => {
    const { application } = await arrange();
    const announced: string[] = [];

    application.domainEvents.on('scheduling.waitlist.slot-offered', async (event) => {
      announced.push(event.name);
    });

    await application.commandBus.execute(new OfferFreedSlotCommand(holder, 'calendar-1', nine));

    expect(announced).toEqual(['scheduling.waitlist.slot-offered']);
    expect(application.eventBus.published).toMatchObject([{ type: 'scheduling.appointment.booked' }]);
  });

  it('looks for the waitlist of the day of the slot on the wall clock of the practice', async () => {
    const { application } = await arrange();

    const lateEvening = {
      startsAt: new Date('2026-03-01T23:00:00.000Z'),
      endsAt: new Date('2026-03-01T23:30:00.000Z'),
      heldUntil: new Date('2026-03-01T23:30:00.000Z'),
    };

    expect(await application.commandBus.execute(new OfferFreedSlotCommand(holder, 'calendar-1', lateEvening))).toBe(
      'appointment-1',
    );
  });

  it.each([
    [
      'nobody waits for that day',
      {
        startsAt: new Date('2026-03-03T08:00:00.000Z'),
        endsAt: new Date('2026-03-03T08:30:00.000Z'),
        heldUntil: new Date('2026-03-03T08:30:00.000Z'),
      },
    ],
    [
      'the slot is shorter than what any waiter asks for',
      { startsAt: paris('09:00'), endsAt: paris('09:15'), heldUntil: paris('09:15') },
    ],
  ])('requests nothing and leaves the waitlist as it was when %s', async (_case, freed) => {
    const { application, appointmentRepository, waitlistRepository } = await arrange();

    expect(
      await application.commandBus.execute(new OfferFreedSlotCommand(holder, 'calendar-1', freed)),
    ).toBeUndefined();

    expect(appointmentRepository.all()).toEqual([]);
    expect((await waitlistRepository.findById('calendar-1.2026-03-02'))?.waiters).toHaveLength(2);
    expect(application.eventBus.published).toEqual([]);
  });

  it('requests nothing over a part of the slot that another appointment still holds', async () => {
    const { application, appointmentRepository } = await arrange();

    await appointmentRepository.save(
      anAppointment().identifiedBy('moved').onCalendar('calendar-1').startingAt(paris('09:15')).build(),
    );

    expect(await application.commandBus.execute(new OfferFreedSlotCommand(holder, 'calendar-1', nine))).toBeUndefined();
    expect(appointmentRepository.all().map((appointment) => appointment.id)).toEqual(['moved']);
  });

  it('refuses a calendar that does not exist', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new OfferFreedSlotCommand(holder, 'calendar-9', nine)),
    ).rejects.toMatchObject({ code: 'UNKNOWN_CALENDAR' });
  });
});

describe('Offer freed slot, when an appointment frees what it held', () => {
  it('offers the slot of a cancelled appointment to the first waiter', async () => {
    const { application, appointmentRepository } = await arrange(authorizationModule({ authorizer: new AllowAll() }));
    const appointments = application.get(AppointmentRepository);
    const booked = anAppointment().identifiedBy('booked').onCalendar('calendar-1').startingAt(paris('09:00')).build();

    await appointments.save(booked);
    booked.cancel(Cancellation.create('patient'), now);
    await appointments.save(booked);

    expect(appointmentRepository.all().filter((appointment) => appointment.isActive)).toMatchObject([
      { status: 'requested', patientId: 'patient-1' },
    ]);
  });

  it('offers the slot to the next waiter when the hold of the first offer expires', async () => {
    const { application, appointmentRepository, waitlistRepository } = await arrange(
      authorizationModule({ authorizer: new AllowAll() }),
    );

    const appointments = application.get(AppointmentRepository);

    const offered = await appointments.findById(
      (await application.commandBus.execute(new OfferFreedSlotCommand(holder, 'calendar-1', nine))) ?? 'none',
    );

    offered?.expire(new Date('2026-02-27T10:30:00.000Z'));
    await appointments.save(offered ?? anAppointment().build());

    expect(appointmentRepository.all().map((appointment) => [appointment.patientId, appointment.status])).toEqual([
      ['patient-1', 'expired'],
      ['patient-2', 'requested'],
    ]);

    expect((await waitlistRepository.findById('calendar-1.2026-03-02'))?.waiters).toEqual([]);
  });
});

async function arrange(authorization = holders) {
  return aSchedulingWorld({
    modules: [authorization],
    idPrefix: 'appointment',
    now,
    given: async (fakes) => {
      await fakes.calendarRepository.save(
        aCalendar().identifiedBy('calendar-1').openEveryDay(['00:00', '24:00']).offering('consultation').build(),
      );

      await fakes.waitlistRepository.save(
        aWaitlist().forCalendar('calendar-1').onDay('2026-03-02').joinedBy('patient-1').joinedBy('patient-2').build(),
      );
    },
  });
}

/** An instant of Monday 2 March 2026 on the wall clock of Paris (UTC+1 that day). */
function paris(time: string): Date {
  return new Date(`2026-03-02T${time}:00.000+01:00`);
}
