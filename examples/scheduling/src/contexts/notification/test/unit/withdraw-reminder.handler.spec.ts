import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { notificationPermissions } from '@/contexts/notification/application/authorization/notification.permissions';
import { WithdrawReminderCommand } from '@/contexts/notification/application/commands/withdraw-reminder/withdraw-reminder.command';
import { aReminder } from '@/contexts/notification/test/builders/reminder.builder';
import { aNotificationWorld } from '@/contexts/notification/test/worlds/notification.world';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { holder: [notificationPermissions['reminder.withdraw']] } }),
});

const holder = anActor().withRole('holder').build();
const startsAt = new Date('2026-01-10T09:00:00.000Z');

describe('Withdraw reminder', () => {
  it('withdraws the planned reminder of the appointment', async () => {
    const { application, reminderRepository } = await arrange();

    await reminderRepository.save(
      aReminder().identifiedBy('reminder-1').of('appointment-1').plannedFor(startsAt).build(),
    );

    await application.commandBus.execute(new WithdrawReminderCommand(holder, 'appointment-1'));

    expect((await reminderRepository.findById('reminder-1'))?.status).toBe('withdrawn');
  });

  it('is refused to an actor who does not hold the permission reminder.withdraw', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new WithdrawReminderCommand(anActor().build(), 'appointment-1')),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('leaves the reminders of other appointments planned', async () => {
    const { application, reminderRepository } = await arrange();

    await reminderRepository.save(aReminder().identifiedBy('reminder-1').of('appointment-1').build());
    await reminderRepository.save(aReminder().identifiedBy('reminder-2').of('appointment-2').build());
    await application.commandBus.execute(new WithdrawReminderCommand(holder, 'appointment-1'));

    expect((await reminderRepository.findById('reminder-2'))?.status).toBe('planned');
  });

  it('leaves a reminder already sent as it is', async () => {
    const { application, reminderRepository } = await arrange();

    await reminderRepository.save(
      aReminder()
        .identifiedBy('reminder-1')
        .of('appointment-1')
        .plannedFor(startsAt)
        .sent(new Date('2026-01-09T10:00:00.000Z'))
        .build(),
    );

    await application.commandBus.execute(new WithdrawReminderCommand(holder, 'appointment-1'));

    expect((await reminderRepository.findById('reminder-1'))?.status).toBe('sent');
  });

  it('changes nothing for an appointment without a reminder, and when asked twice', async () => {
    const { application, reminderRepository } = await arrange();

    await reminderRepository.save(aReminder().identifiedBy('reminder-1').of('appointment-1').build());
    await application.commandBus.execute(new WithdrawReminderCommand(holder, 'appointment-unknown'));
    await application.commandBus.execute(new WithdrawReminderCommand(holder, 'appointment-1'));
    await application.commandBus.execute(new WithdrawReminderCommand(holder, 'appointment-1'));

    expect(reminderRepository.count()).toBe(1);
    expect((await reminderRepository.findById('reminder-1'))?.status).toBe('withdrawn');
    expect(application.eventBus.published).toEqual([]);
  });
});

async function arrange() {
  return aNotificationWorld({
    modules: [holders],
    idPrefix: 'reminder',
  });
}
