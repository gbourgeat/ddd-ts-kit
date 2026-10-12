import { CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { appointmentExpiredV1, type AppointmentExpiredV1 } from '@/contexts/scheduling/published-language/index';
import { WithdrawReminderCommand } from '@/contexts/notification/application/commands/withdraw-reminder/withdraw-reminder.command';

@IntegrationEventHandler(appointmentExpiredV1, { consumer: 'notification.scheduling-appointment-expired' }, [
  CommandBus,
])
export class SchedulingAppointmentExpiredIntegrationHandler {
  static readonly eventType = 'scheduling.appointment.expired';

  readonly actor = systemActor('notification.scheduling-appointment-expired');

  constructor(private readonly commands: CommandBus) {}

  async handle(event: AppointmentExpiredV1): Promise<void> {
    await this.commands.execute(new WithdrawReminderCommand(this.actor, event.payload.appointmentId));
  }
}
