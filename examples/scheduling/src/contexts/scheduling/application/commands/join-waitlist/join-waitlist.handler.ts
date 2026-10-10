import { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Waitlist } from '../../../domain/aggregates/waitlist.aggregate.js';
import { UnknownCalendarError } from '../../../domain/errors/unknown-calendar.error.js';
import { CalendarRepository } from '../../../domain/repositories/calendar.repository.js';
import { WaitlistRepository } from '../../../domain/repositories/waitlist.repository.js';
import { JoinWaitlistCommand } from './join-waitlist.command.js';

/** Answers the identifier of the waitlist: the one of the calendar and the day, opened by its first waiter. */
@CommandHandler(JoinWaitlistCommand, [WaitlistRepository, CalendarRepository, Clock])
export class JoinWaitlistHandler implements CommandHandler<JoinWaitlistCommand> {
  constructor(
    private readonly waitlistRepository: WaitlistRepository,
    private readonly calendarRepository: CalendarRepository,
    private readonly clock: Clock,
  ) {}

  async execute({ calendarId, wait }: JoinWaitlistCommand): Promise<string> {
    const calendar = await this.calendarRepository.findById(calendarId);

    if (calendar === undefined) {
      throw new UnknownCalendarError(calendarId);
    }

    const now = this.clock.now();
    const waiter = calendar.admit(wait.patientId, wait.appointmentTypeId, now);

    const target =
      (await this.waitlistRepository.findById(Waitlist.idOf(calendarId, wait.day))) ??
      Waitlist.create({ calendarId, day: wait.day }, now);

    target.join(waiter, now);

    await this.waitlistRepository.save(target);

    return target.id;
  }
}
