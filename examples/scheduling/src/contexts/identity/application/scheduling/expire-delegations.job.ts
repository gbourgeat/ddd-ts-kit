import { CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { Scheduled, type JobExecution, type ScheduledJob } from '@ddd-ts-kit/kernel/declarations';
import { ExpireDelegationsCommand } from '@/contexts/identity/application/commands/expire-delegations/expire-delegations.command';

@Scheduled('identity.expire-delegations', { every: '5m' })
export class ExpireDelegationsJob implements ScheduledJob {
  constructor(private readonly commands: CommandBus) {}

  async run(execution: JobExecution): Promise<void> {
    await this.commands.execute(
      new ExpireDelegationsCommand(systemActor('identity.expire-delegations'), execution.scheduledAt),
    );
  }
}
