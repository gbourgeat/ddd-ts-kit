import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import type { ReminderRepository } from '@/contexts/notification/domain/repositories/reminder.repository';
import { SendDueRemindersCommand } from '@/contexts/notification/application/commands/send-due-reminders/send-due-reminders.command';

@CommandHandler(SendDueRemindersCommand)
export class SendDueRemindersHandler implements CommandHandler<SendDueRemindersCommand> {
  constructor(private readonly reminderRepository: ReminderRepository) {}

  async execute(command: SendDueRemindersCommand): Promise<void> {
    const due = await this.reminderRepository.findDue(command.asOf);

    for (const target of due) {
      target.send(command.asOf);

      await this.reminderRepository.save(target);
    }
  }
}
