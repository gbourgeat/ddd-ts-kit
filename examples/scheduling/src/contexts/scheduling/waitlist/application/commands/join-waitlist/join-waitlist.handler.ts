import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Waitlist } from '@/contexts/scheduling/waitlist/domain/aggregates/waitlist.aggregate';
import { UnknownCalendar } from '@/contexts/scheduling/calendars/domain/errors/unknown-calendar.error';
import type { CalendarRepository } from '@/contexts/scheduling/calendars/domain/repositories/calendar.repository';
import type { WaitlistRepository } from '@/contexts/scheduling/waitlist/domain/repositories/waitlist.repository';
import { Waiter } from '@/contexts/scheduling/waitlist/domain/value-objects/waiter.vo';
import { JoinWaitlistCommand } from '@/contexts/scheduling/waitlist/application/commands/join-waitlist/join-waitlist.command';

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
      throw UnknownCalendar.forCalendar(calendarId);
    }

    const now = this.clock.now();
    const { id: appointmentTypeId } = calendar.appointmentType(wait.appointmentTypeId);
    const waiter = Waiter.create({ patientId: wait.patientId, appointmentTypeId, joinedAt: now });

    const waitlist =
      (await this.waitlistRepository.findById(Waitlist.idOf(calendarId, wait.day))) ??
      Waitlist.create({ calendarId, day: wait.day }, now);

    waitlist.join(waiter, now);

    await this.waitlistRepository.save(waitlist);

    return waitlist.id;
  }
}
