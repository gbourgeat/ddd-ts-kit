import { CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { appointmentCancelledV1, type AppointmentCancelledV1 } from '../../../../scheduling/published-language/index.js';
import { SendNotificationCommand } from '../../commands/send-notification/send-notification.command.js';

@IntegrationEventHandler(appointmentCancelledV1, { consumer: 'notification.scheduling-appointment-cancelled' }, [CommandBus])
export class SchedulingAppointmentCancelledIntegrationHandler {
  static readonly eventType = 'scheduling.appointment.cancelled';

  readonly actor = systemActor('notification.scheduling-appointment-cancelled');

  constructor(private readonly commands: CommandBus) {}

  async handle(event: AppointmentCancelledV1): Promise<void> {
    const { patientId, appointmentId, startsAt } = event.payload;

    await this.commands.execute(new SendNotificationCommand(this.actor, { recipientId: patientId, kind: 'cancellation', appointmentId, startsAt: new Date(startsAt), cause: event.id }));
  }
}
