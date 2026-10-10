import { CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import {
  appointmentConfirmedV1,
  type AppointmentConfirmedV1,
} from '../../../../scheduling/published-language/index.js';
import { SendNotificationCommand } from '../../commands/send-notification/send-notification.command.js';

@IntegrationEventHandler(appointmentConfirmedV1, { consumer: 'notification.scheduling-appointment-confirmed' }, [
  CommandBus,
])
export class SchedulingAppointmentConfirmedIntegrationHandler {
  static readonly eventType = 'scheduling.appointment.confirmed';

  readonly actor = systemActor('notification.scheduling-appointment-confirmed');

  constructor(private readonly commands: CommandBus) {}

  async handle(event: AppointmentConfirmedV1): Promise<void> {
    const { patientId, appointmentId, startsAt } = event.payload;

    await this.commands.execute(
      new SendNotificationCommand(this.actor, {
        recipientId: patientId,
        kind: 'confirmation',
        appointmentId,
        startsAt: new Date(startsAt),
        cause: event.id,
      }),
    );
  }
}
