import { Access } from '@ddd-ts-kit/auth';
import type { Actor, Clock, IdGenerator } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { UnknownCalendar } from '@/contexts/scheduling/calendars/domain/errors/unknown-calendar.error';
import type { AppointmentRepository } from '@/contexts/scheduling/calendars/domain/repositories/appointment.repository';
import type { CalendarRepository } from '@/contexts/scheduling/calendars/domain/repositories/calendar.repository';
import { SchedulerService } from '@/contexts/scheduling/calendars/domain/services/scheduler.service';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';
import { BookAppointmentCommand } from '@/contexts/scheduling/calendars/application/commands/book-appointment/book-appointment.command';

/** An appointment and its buffer never last a day: what could overlap a slot is held within a day of its start. */
const DAY = 24 * 60 * 60_000;

@CommandHandler(BookAppointmentCommand)
export class BookAppointmentHandler implements CommandHandler<BookAppointmentCommand> {
  private readonly scheduler = new SchedulerService();

  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly calendarRepository: CalendarRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly access: Access,
  ) {}

  /** The check below refuses what is already held; between two bookings of the same instant, the storage refuses the second with the same error. */
  async execute({ actor, calendarId, wish }: BookAppointmentCommand): Promise<string> {
    const calendar = await this.calendarRepository.findById(calendarId);

    if (calendar === undefined) {
      throw UnknownCalendar.forCalendar(calendarId);
    }

    const now = this.clock.now();
    const start = wish.startsAt.getTime();

    const held = {
      onCalendar: await this.appointmentRepository.heldOn(calendarId, new Date(start - DAY), new Date(start + DAY)),
      byPatient: await this.appointmentRepository.heldBy(wish.patientId, calendar.practitionerId, now),
    };

    const appointment = this.scheduler.book({ ...wish, id: this.ids.next(), now }, calendar, held);

    if (wish.internalNote !== undefined) {
      await this.mayAnnotate(actor, calendarId);
      appointment.annotate(wish.internalNote, now);
    }

    await this.appointmentRepository.save(appointment);

    return appointment.id;
  }

  /** Whoever sends the command, through HTTP or not, writes a note only on a calendar of their own desk, or of the practice they manage. */
  private async mayAnnotate(actor: Actor, calendarId: string): Promise<void> {
    await this.access.authorize(actor, schedulingPermissions['appointment.note.write'], {
      type: 'calendar',
      id: calendarId,
    });
  }
}
