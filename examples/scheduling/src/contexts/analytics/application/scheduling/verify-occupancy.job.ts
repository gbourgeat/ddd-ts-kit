import { CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { Scheduled, type JobExecution, type ScheduledJob } from '@ddd-ts-kit/kernel/declarations';
import { VerifyOccupancyCommand } from '../commands/verify-occupancy/verify-occupancy.command.js';

@Scheduled('analytics.verify-occupancy', { cron: '0 3 * * *', timeZone: 'Europe/Paris' }, [CommandBus])
export class VerifyOccupancyJob implements ScheduledJob {
  constructor(private readonly commands: CommandBus) {}

  async run(execution: JobExecution): Promise<void> {
    await this.commands.execute(new VerifyOccupancyCommand(systemActor('analytics.verify-occupancy'), execution.scheduledAt));
  }
}
