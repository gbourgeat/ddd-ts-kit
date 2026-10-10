import { CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import {
  appointmentRescheduledV1,
  type AppointmentRescheduledV1,
} from '../../../../scheduling/published-language/index.js';
import { SendNotificationCommand } from '../../commands/send-notification/send-notification.command.js';

@IntegrationEventHandler(appointmentRescheduledV1, { consumer: 'notification.scheduling-appointment-rescheduled' }, [
  CommandBus,
])
export class SchedulingAppointmentRescheduledIntegrationHandler {
  static readonly eventType = 'scheduling.appointment.rescheduled';

  readonly actor = systemActor('notification.scheduling-appointment-rescheduled');

  constructor(private readonly commands: CommandBus) {}

  async handle(event: AppointmentRescheduledV1): Promise<void> {
    const { patientId, appointmentId, startsAt } = event.payload;

    await this.commands.execute(
      new SendNotificationCommand(this.actor, {
        recipientId: patientId,
        kind: 'rescheduling',
        appointmentId,
        startsAt: new Date(startsAt),
        cause: event.id,
      }),
    );
  }
}
