import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { ReminderRepository } from '#src/contexts/notification/domain/repositories/reminder.repository.js';
import { SendDueRemindersCommand } from '#src/contexts/notification/application/commands/send-due-reminders/send-due-reminders.command.js';

@CommandHandler(SendDueRemindersCommand, [ReminderRepository])
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
