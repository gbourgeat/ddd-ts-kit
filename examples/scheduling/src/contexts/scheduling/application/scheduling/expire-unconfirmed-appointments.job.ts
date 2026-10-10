import { CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { Scheduled, type JobExecution, type ScheduledJob } from '@ddd-ts-kit/kernel/declarations';
import { ExpireUnconfirmedAppointmentsCommand } from '#src/contexts/scheduling/application/commands/expire-unconfirmed-appointments/expire-unconfirmed-appointments.command.js';

@Scheduled('scheduling.expire-unconfirmed-appointments', { every: '5m' }, [CommandBus])
export class ExpireUnconfirmedAppointmentsJob implements ScheduledJob {
  constructor(private readonly commands: CommandBus) {}

  async run(execution: JobExecution): Promise<void> {
    await this.commands.execute(
      new ExpireUnconfirmedAppointmentsCommand(
        systemActor('scheduling.expire-unconfirmed-appointments'),
        execution.scheduledAt,
      ),
    );
  }
}
