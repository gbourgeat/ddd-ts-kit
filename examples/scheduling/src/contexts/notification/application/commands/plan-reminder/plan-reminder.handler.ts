import { Clock, IdGenerator } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Reminder } from '@/contexts/notification/domain/aggregates/reminder.aggregate';
import { ReminderRepository } from '@/contexts/notification/domain/repositories/reminder.repository';
import { PlanReminderCommand } from '@/contexts/notification/application/commands/plan-reminder/plan-reminder.command';

@CommandHandler(PlanReminderCommand)
export class PlanReminderHandler implements CommandHandler<PlanReminderCommand> {
  constructor(
    private readonly reminderRepository: ReminderRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: PlanReminderCommand): Promise<string> {
    const planned = await this.reminderRepository.findByAppointment(command.appointment.appointmentId);
    const target = planned ?? Reminder.create(this.ids.next(), command.appointment, this.clock.now());

    target.planFor(command.appointment.startsAt);

    await this.reminderRepository.save(target);

    return target.id;
  }
}
