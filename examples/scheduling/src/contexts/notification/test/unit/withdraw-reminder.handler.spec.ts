import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as notificationDeclarations from '../../notification.declarations.js';
import { platformTestModule } from '../../../../platform/platform-test.module.js';
import { notificationPermissions } from '../../application/authorization/notification.permissions.js';
import { WithdrawReminderCommand } from '../../application/commands/withdraw-reminder/withdraw-reminder.command.js';
import { ReminderRepository } from '../../domain/repositories/reminder.repository.js';
import { aReminder } from '../builders/reminder.builder.js';
import { FakeReminderRepository } from '../fakes/reminder.repository.fake.js';

const holders = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: { holder: [notificationPermissions['reminder.withdraw']] } }) });
const holder = anActor().withRole('holder').build();
const startsAt = new Date('2026-01-10T09:00:00.000Z');

describe('Withdraw reminder', () => {
  it('withdraws the planned reminder of the appointment', async () => {
    const { application, reminderRepository } = arrange();

    await reminderRepository.save(aReminder().identifiedBy('reminder-1').of('appointment-1').plannedFor(startsAt).build());
    await application.commandBus.execute(new WithdrawReminderCommand(holder, 'appointment-1'));

    expect((await reminderRepository.findById('reminder-1'))?.status).toBe('withdrawn');
  });

  it('is refused to an actor who does not hold the permission reminder.withdraw', async () => {
    const { application } = arrange();

    await expect(application.commandBus.execute(new WithdrawReminderCommand(anActor().build(), 'appointment-1'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('leaves the reminders of other appointments planned', async () => {
    const { application, reminderRepository } = arrange();

    await reminderRepository.save(aReminder().identifiedBy('reminder-1').of('appointment-1').build());
    await reminderRepository.save(aReminder().identifiedBy('reminder-2').of('appointment-2').build());
    await application.commandBus.execute(new WithdrawReminderCommand(holder, 'appointment-1'));

    expect((await reminderRepository.findById('reminder-2'))?.status).toBe('planned');
  });

  it('leaves a reminder already sent as it is', async () => {
    const { application, reminderRepository } = arrange();

    await reminderRepository.save(aReminder().identifiedBy('reminder-1').of('appointment-1').plannedFor(startsAt).sent(new Date('2026-01-09T10:00:00.000Z')).build());
    await application.commandBus.execute(new WithdrawReminderCommand(holder, 'appointment-1'));

    expect((await reminderRepository.findById('reminder-1'))?.status).toBe('sent');
  });

  it('changes nothing for an appointment without a reminder, and when asked twice', async () => {
    const { application, reminderRepository } = arrange();

    await reminderRepository.save(aReminder().identifiedBy('reminder-1').of('appointment-1').build());
    await application.commandBus.execute(new WithdrawReminderCommand(holder, 'appointment-unknown'));
    await application.commandBus.execute(new WithdrawReminderCommand(holder, 'appointment-1'));
    await application.commandBus.execute(new WithdrawReminderCommand(holder, 'appointment-1'));

    expect(reminderRepository.count()).toBe(1);
    expect((await reminderRepository.findById('reminder-1'))?.status).toBe('withdrawn');
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
