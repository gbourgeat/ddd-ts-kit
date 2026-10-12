import { CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { appointmentCancelledV1, type AppointmentCancelledV1 } from '@/contexts/scheduling/published-language/index';
import { SendNotificationCommand } from '@/contexts/notification/application/commands/send-notification/send-notification.command';

@IntegrationEventHandler(appointmentCancelledV1, { consumer: 'notification.scheduling-appointment-cancelled' })
export class SchedulingAppointmentCancelledIntegrationHandler {
  static readonly eventType = 'scheduling.appointment.cancelled';

  readonly actor = systemActor('notification.scheduling-appointment-cancelled');

  constructor(private readonly commands: CommandBus) {}

  async handle(event: AppointmentCancelledV1): Promise<void> {
    const { patientId, appointmentId, startsAt } = event.payload;

    await this.commands.execute(
      new SendNotificationCommand(this.actor, {
        recipientId: patientId,
        kind: 'cancellation',
        appointmentId,
        startsAt: new Date(startsAt),
        cause: event.id,
      }),
    );
  }
}
