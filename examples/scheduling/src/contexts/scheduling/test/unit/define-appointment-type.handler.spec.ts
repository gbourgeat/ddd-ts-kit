import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { DefineAppointmentTypeCommand } from '@/contexts/scheduling/application/commands/define-appointment-type/define-appointment-type.command';
import { aCalendar } from '@/contexts/scheduling/test/builders/calendar.builder';
import { aSchedulingWorld } from '@/contexts/scheduling/test/worlds/scheduling.world';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: { holder: [schedulingPermissions['calendar.define-appointment-type']] },
  }),
});

const holder = anActor().withRole('holder').build();
const consultation = { name: 'Consultation', duration: 30, grid: 15, buffer: 10, needsConfirmation: true };

describe('Define appointment type', () => {
  it('makes the calendar offer the type and answers the identifier of the type', async () => {
    const { application, calendarRepository } = await arrange();

    const id = await application.commandBus.execute(
      new DefineAppointmentTypeCommand(holder, 'calendar-1', consultation),
    );

    const stored = await calendarRepository.findById('calendar-1');

    expect(id).toBe('type-1');
    expect(stored?.appointmentTypes.map((type) => type.toJSON())).toEqual([{ id: 'type-1', ...consultation }]);
  });

  it('is refused to an actor who does not hold the permission calendar.define-appointment-type', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new DefineAppointmentTypeCommand(anActor().build(), 'calendar-1', consultation)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('keeps the types the calendar already offers', async () => {
    const { application, calendarRepository } = await arrange();

    await application.commandBus.execute(new DefineAppointmentTypeCommand(holder, 'calendar-1', consultation));

    await application.commandBus.execute(
      new DefineAppointmentTypeCommand(holder, 'calendar-1', { ...consultation, name: 'Surgery' }),
    );

    expect((await calendarRepository.findById('calendar-1'))?.appointmentTypes.map((type) => type.name)).toEqual([
      'Consultation',
      'Surgery',
    ]);
  });

  it('announces the type that was defined', async () => {
    const { application } = await arrange();
    const announced: unknown[] = [];

    application.domainEvents.on('scheduling.calendar.appointment-type-defined', async (event) => {
      announced.push(event);
    });

    await application.commandBus.execute(new DefineAppointmentTypeCommand(holder, 'calendar-1', consultation));

    expect(announced).toMatchObject([{ aggregateId: 'calendar-1', appointmentTypeId: 'type-1' }]);
  });

  it.each([
    ['a duration of zero', { duration: 0 }],
    ['a grid that does not divide a day', { grid: 7 }],
    ['a negative buffer', { buffer: -1 }],
  ])('refuses %s and leaves the calendar as it was', async (_case, facts) => {
    const { application, calendarRepository } = await arrange();

    await expect(
      application.commandBus.execute(
        new DefineAppointmentTypeCommand(holder, 'calendar-1', { ...consultation, ...facts }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_APPOINTMENT_TYPE' });

    expect((await calendarRepository.findById('calendar-1'))?.appointmentTypes).toEqual([]);
  });

  it('refuses a calendar that does not exist', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new DefineAppointmentTypeCommand(holder, 'calendar-9', consultation)),
    ).rejects.toMatchObject({ code: 'UNKNOWN_CALENDAR' });
  });
});

async function arrange() {
  const { application, calendarRepository } = await aSchedulingWorld({
    modules: [holders],
    idPrefix: 'type',
    given: async (fakes) => {
      await fakes.calendarRepository.save(aCalendar().identifiedBy('calendar-1').build());
    },
  });

  return { application, calendarRepository };
}
