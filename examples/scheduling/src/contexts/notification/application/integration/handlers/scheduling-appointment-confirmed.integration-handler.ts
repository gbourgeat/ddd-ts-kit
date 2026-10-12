import { type CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { appointmentConfirmedV1, type AppointmentConfirmedV1 } from '@/contexts/scheduling/published-language/index';
import { SendNotificationCommand } from '@/contexts/notification/application/commands/send-notification/send-notification.command';
import { NotificationKindName } from '@/contexts/notification/domain/vocabularies/notification-kind-name.vocabulary';

@IntegrationEventHandler(appointmentConfirmedV1, { consumer: 'notification.scheduling-appointment-confirmed' })
export class SchedulingAppointmentConfirmedIntegrationHandler {
  static readonly eventType = 'scheduling.appointment.confirmed';

  readonly actor = systemActor('notification.scheduling-appointment-confirmed');

  constructor(private readonly commands: CommandBus) {}

  async handle(event: AppointmentConfirmedV1): Promise<void> {
    const { patientId, appointmentId, startsAt } = event.payload;

    await this.commands.execute(
      new SendNotificationCommand(this.actor, {
        recipientId: patientId,
        kind: NotificationKindName.Confirmation,
        appointmentId,
        startsAt: new Date(startsAt),
        cause: event.id,
      }),
    );
  }
}
