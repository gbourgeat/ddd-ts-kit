import { CommandBus } from '../../../../../../../src/index.js';
import { Scheduled, type JobExecution, type ScheduledJob } from '../../../../../../../src/declarations.js';
import { RequestCallback } from '../commands/request-callback/request-callback.command.js';

@Scheduled('clinic.remind-tomorrow-visits', { cron: '0 18 * * mon-fri', timeZone: 'Europe/Paris', overlap: 'queue', timeoutMs: 120_000 }, [CommandBus])
export class RemindTomorrowVisits implements ScheduledJob {
  static built = 0;

  constructor(private readonly commands: CommandBus) {
    RemindTomorrowVisits.built += 1;
  }

  async run(execution: JobExecution): Promise<void> {
    await this.commands.execute(new RequestCallback(`visits after ${execution.scheduledAt.toISOString()}`));
  }
}
