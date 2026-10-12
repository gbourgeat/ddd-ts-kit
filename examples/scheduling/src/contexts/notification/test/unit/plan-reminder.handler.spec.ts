import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as notificationDeclarations from '@/contexts/notification/notification.declarations';
import { platformTestModule } from '@/platform/platform-test.module';
import { notificationPermissions } from '@/contexts/notification/application/authorization/notification.permissions';
import { PlanReminderCommand } from '@/contexts/notification/application/commands/plan-reminder/plan-reminder.command';
import { ReminderRepository } from '@/contexts/notification/domain/repositories/reminder.repository';
import { aReminder } from '@/contexts/notification/test/builders/reminder.builder';
import { FakeReminderRepository } from '@/contexts/notification/test/fakes/reminder.repository.fake';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { holder: [notificationPermissions['reminder.plan']] } }),
});

const holder = anActor().withRole('holder').build();
const startsAt = new Date('2026-01-10T09:00:00.000Z');
const appointment = { appointmentId: 'appointment-1', recipientId: 'patient-1', startsAt };

describe('Plan reminder', () => {
  it('saves the reminder and answers its identifier', async () => {
    const { application, reminderRepository } = arrange();

    const id = await application.commandBus.execute(new PlanReminderCommand(holder, appointment));

    expect(id).toBe('reminder-1');
    expect(await reminderRepository.findById(id)).toBeDefined();
  });

  it('is refused to an actor who does not hold the permission reminder.plan', async () => {
    const { application } = arrange();

    await expect(
      application.commandBus.execute(new PlanReminderCommand(anActor().build(), appointment)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('plans the reminder of the appointment, due 24 hours before its start', async () => {
    const { application, reminderRepository } = arrange();

    const id = await application.commandBus.execute(new PlanReminderCommand(holder, appointment));

    expect((await reminderRepository.findById(id))?.toState()).toMatchObject({
      appointmentId: 'appointment-1',
      recipientId: 'patient-1',
      startsAt,
      dueAt: new Date('2026-01-09T09:00:00.000Z'),
      status: 'planned',
    });
  });

  it('keeps one reminder per appointment and start: planning twice answers the same reminder', async () => {
    const { application, reminderRepository } = arrange();
    const first = await application.commandBus.execute(new PlanReminderCommand(holder, appointment));

    const second = await application.commandBus.execute(new PlanReminderCommand(holder, appointment));

    expect(second).toBe(first);
    expect(reminderRepository.count()).toBe(1);
  });

  it('does not plan again a reminder already sent for the same start', async () => {
    const { application, reminderRepository } = arrange();

    await reminderRepository.save(
      aReminder()
        .identifiedBy('reminder-sent')
        .of('appointment-1')
        .plannedFor(startsAt)
        .sent(new Date('2026-01-09T10:00:00.000Z'))
        .build(),
    );

    await application.commandBus.execute(new PlanReminderCommand(holder, appointment));

    expect((await reminderRepository.findById('reminder-sent'))?.status).toBe('sent');
  });

  it('makes the reminder of a moved appointment due again, 24 hours before the new start', async () => {
    const { application, reminderRepository } = arrange();
    const movedTo = new Date('2026-02-01T15:00:00.000Z');

    await reminderRepository.save(
      aReminder()
        .identifiedBy('reminder-sent')
        .of('appointment-1')
        .plannedFor(startsAt)
        .sent(new Date('2026-01-09T10:00:00.000Z'))
        .build(),
    );

    await application.commandBus.execute(new PlanReminderCommand(holder, { ...appointment, startsAt: movedTo }));

    expect((await reminderRepository.findById('reminder-sent'))?.toState()).toMatchObject({
      status: 'planned',
      startsAt: movedTo,
      dueAt: new Date('2026-01-31T15:00:00.000Z'),
    });

    expect(reminderRepository.count()).toBe(1);
  });

  it('announces nothing to other contexts', async () => {
    const { application } = arrange();

    await application.commandBus.execute(new PlanReminderCommand(holder, appointment));

    expect(application.eventBus.published).toEqual([]);
  });
});

function arrange() {
  const reminderRepository = new FakeReminderRepository();

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('notification', notificationDeclarations), holders],
    fakes: [fake(ReminderRepository, reminderRepository)],
    idPrefix: 'reminder',
  });

  return { application, reminderRepository };
}
