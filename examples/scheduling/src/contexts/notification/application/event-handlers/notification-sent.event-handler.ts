import { type CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { NotificationSent } from '@/contexts/notification/domain/events/notification-sent.event';
import { PlanReminderCommand } from '@/contexts/notification/application/commands/plan-reminder/plan-reminder.command';
import { WithdrawReminderCommand } from '@/contexts/notification/application/commands/withdraw-reminder/withdraw-reminder.command';

/**
 * When a notification told of an appointment to come, its reminder is planned for the start it
 * named; when it told of its end, the reminder is withdrawn. A reminder itself calls for nothing.
 */
@DomainEventHandler(NotificationSent, { name: 'notification.notification.sent' })
export class NotificationSentEventHandler implements DomainEventHandler<NotificationSent> {
  readonly actor = systemActor('notification.notification-sent');

  constructor(private readonly commands: CommandBus) {}

  async handle(event: NotificationSent): Promise<void> {
    const { kind, appointmentId, recipientId, startsAt } = event.about;

    if (kind.announcesAnAppointmentToCome()) {
      await this.commands.execute(new PlanReminderCommand(this.actor, { appointmentId, recipientId, startsAt }));
    }

    if (kind.announcesTheEndOfAnAppointment()) {
      await this.commands.execute(new WithdrawReminderCommand(this.actor, appointmentId));
    }
  }
}
