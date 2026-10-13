import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Waitlist } from '@/contexts/scheduling/domain/aggregates/waitlist.aggregate';
import { CalendarError } from '@/contexts/scheduling/domain/errors/calendar.error';
import type { CalendarRepository } from '@/contexts/scheduling/domain/repositories/calendar.repository';
import type { WaitlistRepository } from '@/contexts/scheduling/domain/repositories/waitlist.repository';
import { JoinWaitlistCommand } from '@/contexts/scheduling/application/commands/join-waitlist/join-waitlist.command';

/** Answers the identifier of the waitlist: the one of the calendar and the day, opened by its first waiter. */
@CommandHandler(JoinWaitlistCommand)
export class JoinWaitlistHandler implements CommandHandler<JoinWaitlistCommand> {
  constructor(
    private readonly waitlistRepository: WaitlistRepository,
    private readonly calendarRepository: CalendarRepository,
    private readonly clock: Clock,
  ) {}

  async execute({ calendarId, wait }: JoinWaitlistCommand): Promise<string> {
    const calendar = await this.calendarRepository.findById(calendarId);

    if (calendar === undefined) {
      throw CalendarError.unknown(calendarId);
    }

    const now = this.clock.now();
    const waiter = calendar.admit(wait.patientId, wait.appointmentTypeId, now);

    const waitlist =
      (await this.waitlistRepository.findById(Waitlist.idOf(calendarId, wait.day))) ??
      Waitlist.create({ calendarId, day: wait.day }, now);

    waitlist.join(waiter, now);

    await this.waitlistRepository.save(waitlist);

    return waitlist.id;
  }
}
