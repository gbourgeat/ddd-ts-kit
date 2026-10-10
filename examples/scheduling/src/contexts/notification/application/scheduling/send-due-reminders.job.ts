import { CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { Scheduled, type JobExecution, type ScheduledJob } from '@ddd-ts-kit/kernel/declarations';
import { SendDueRemindersCommand } from '#src/contexts/notification/application/commands/send-due-reminders/send-due-reminders.command.js';

@Scheduled('notification.send-due-reminders', { every: '15m' }, [CommandBus])
export class SendDueRemindersJob implements ScheduledJob {
  constructor(private readonly commands: CommandBus) {}

  async run(execution: JobExecution): Promise<void> {
    await this.commands.execute(
      new SendDueRemindersCommand(systemActor('notification.send-due-reminders'), execution.scheduledAt),
    );
  }
}
