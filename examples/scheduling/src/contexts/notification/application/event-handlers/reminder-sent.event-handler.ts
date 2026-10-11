import { CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { ReminderSent } from '@/contexts/notification/domain/events/reminder-sent.event';
import { SendNotificationCommand } from '@/contexts/notification/application/commands/send-notification/send-notification.command';

/** When a reminder is sent, its recipient is notified, once per reminder and start. */
@DomainEventHandler(ReminderSent, { name: 'notification.reminder.sent' }, [CommandBus])
export class ReminderSentEventHandler implements DomainEventHandler<ReminderSent> {
  readonly actor = systemActor('notification.reminder-sent');

  constructor(private readonly commands: CommandBus) {}

  async handle(event: ReminderSent): Promise<void> {
    const cause = 'reminder:' + event.aggregateId + '@' + event.about.startsAt.toISOString();

    await this.commands.execute(new SendNotificationCommand(this.actor, { ...event.about, kind: 'reminder', cause }));
  }
}
