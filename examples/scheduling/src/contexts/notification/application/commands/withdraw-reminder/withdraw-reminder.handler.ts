import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { ReminderRepository } from '@/contexts/notification/domain/repositories/reminder.repository';
import { WithdrawReminderCommand } from '@/contexts/notification/application/commands/withdraw-reminder/withdraw-reminder.command';

@CommandHandler(WithdrawReminderCommand)
export class WithdrawReminderHandler implements CommandHandler<WithdrawReminderCommand> {
  constructor(private readonly reminderRepository: ReminderRepository) {}

  async execute(command: WithdrawReminderCommand): Promise<void> {
    const target = await this.reminderRepository.findByAppointment(command.appointmentId);

    // An appointment no reminder was planned for has nothing to withdraw: the fact may be delivered twice, or alone.
    if (target === undefined) {
      return;
    }

    target.withdraw();

    await this.reminderRepository.save(target);
  }
}
