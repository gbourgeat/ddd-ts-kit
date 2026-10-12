import { CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { appointmentBookedV1, type AppointmentBookedV1 } from '@/contexts/scheduling/published-language/index';
import { SendNotificationCommand } from '@/contexts/notification/application/commands/send-notification/send-notification.command';

@IntegrationEventHandler(appointmentBookedV1, { consumer: 'notification.scheduling-appointment-booked' }, [CommandBus])
export class SchedulingAppointmentBookedIntegrationHandler {
  static readonly eventType = 'scheduling.appointment.booked';

  readonly actor = systemActor('notification.scheduling-appointment-booked');

  constructor(private readonly commands: CommandBus) {}

  async handle(event: AppointmentBookedV1): Promise<void> {
    const { patientId, appointmentId, startsAt, status } = event.payload;
    const kind = status === 'requested' ? 'request' : 'confirmation';

    await this.commands.execute(
      new SendNotificationCommand(this.actor, {
        recipientId: patientId,
        kind,
        appointmentId,
        startsAt: new Date(startsAt),
        cause: event.id,
      }),
    );
  }
}
