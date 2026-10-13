import { type CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import {
  appointmentRescheduledV1,
  type AppointmentRescheduledV1,
} from '@/contexts/scheduling/published-language/index';
import { SendNotificationCommand } from '@/contexts/notification/application/commands/send-notification/send-notification.command';
import { NotificationKindName } from '@/contexts/notification/domain/vocabularies/notification-kind-name.vocabulary';

@IntegrationEventHandler(appointmentRescheduledV1, { consumer: 'notification.scheduling-appointment-rescheduled' })
export class SchedulingAppointmentRescheduledIntegrationHandler {
  static readonly eventType = appointmentRescheduledV1.type;

  readonly actor = systemActor('notification.scheduling-appointment-rescheduled');

  constructor(private readonly commands: CommandBus) {}

  async handle(event: AppointmentRescheduledV1): Promise<void> {
    const { patientId, appointmentId, startsAt } = event.payload;

    await this.commands.execute(
      new SendNotificationCommand(this.actor, {
        recipientId: patientId,
        kind: NotificationKindName.Rescheduling,
        appointmentId,
        startsAt: new Date(startsAt),
        cause: event.id,
      }),
    );
  }
}
