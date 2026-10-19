import type { JobQueue } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { ClearCalendarBackgroundJob } from '@/contexts/scheduling/application/background/clear-calendar.background-job';
import { ClearCalendarCommand } from '@/contexts/scheduling/application/commands/clear-calendar/clear-calendar.command';
import { UnknownCalendar } from '@/contexts/scheduling/domain/errors/unknown-calendar.error';
import type { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';
import type { CalendarRepository } from '@/contexts/scheduling/domain/repositories/calendar.repository';
import { TimeOff } from '@/contexts/scheduling/domain/value-objects/time-off.vo';

/**
 * Names the appointments a time off over the period would cover, and hands their cancellation
 * to a worker in the unit of work of the command: a request that fails leaves no clearance. The
 * calendar is the subject of the job, which ties the clearance to it when it is read. The list
 * is fixed now and the period is not reserved: an appointment booked before the time off is
 * added is neither cancelled nor blocked, and the time off is then refused again.
 */
@CommandHandler(ClearCalendarCommand)
export class ClearCalendarHandler implements CommandHandler<ClearCalendarCommand> {
  constructor(
    private readonly calendarRepository: CalendarRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly jobs: JobQueue,
  ) {}

  async execute(command: ClearCalendarCommand): Promise<string> {
    const calendar = await this.calendarRepository.findById(command.calendarId);

    if (calendar === undefined) {
      throw UnknownCalendar.forCalendar(command.calendarId);
    }

    const period = TimeOff.create(command.startsAt, command.endsAt);
    const held = await this.appointmentRepository.heldOn(calendar.id, period.startsAt, period.endsAt);
    const covered = held.filter(({ slot }) => period.covers(slot.startsAt, slot.endsAt));

    const clearance = await this.jobs.enqueue(
      ClearCalendarBackgroundJob,
      { calendarId: calendar.id, appointmentIds: covered.map(({ id }) => id), reason: command.reason },
      { subject: calendar.id },
    );

    return clearance.id;
  }
}
