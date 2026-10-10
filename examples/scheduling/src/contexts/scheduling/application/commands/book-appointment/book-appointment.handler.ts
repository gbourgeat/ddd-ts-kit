import { Clock, IdGenerator } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { UnknownCalendarError } from '../../../domain/errors/unknown-calendar.error.js';
import { AppointmentRepository } from '../../../domain/repositories/appointment.repository.js';
import { CalendarRepository } from '../../../domain/repositories/calendar.repository.js';
import { SchedulerService } from '../../../domain/services/scheduler.service.js';
import { BookAppointmentCommand } from './book-appointment.command.js';

/** An appointment and its buffer never last a day: what could overlap a slot is held within a day of its start. */
const DAY = 24 * 60 * 60_000;

@CommandHandler(BookAppointmentCommand, [AppointmentRepository, CalendarRepository, IdGenerator, Clock])
export class BookAppointmentHandler implements CommandHandler<BookAppointmentCommand> {
  private readonly scheduler = new SchedulerService();

  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly calendarRepository: CalendarRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /** The check below refuses what is already held; between two bookings of the same instant, the storage refuses the second with the same error. */
  async execute({ calendarId, wish }: BookAppointmentCommand): Promise<string> {
    const calendar = await this.calendarRepository.findById(calendarId);

    if (calendar === undefined) {
      throw new UnknownCalendarError(calendarId);
    }

    const now = this.clock.now();
    const start = wish.startsAt.getTime();

    const held = {
      onCalendar: await this.appointmentRepository.heldOn(calendarId, new Date(start - DAY), new Date(start + DAY)),
      byPatient: await this.appointmentRepository.heldBy(wish.patientId, calendar.practitionerId, now),
    };

    const target = this.scheduler.book({ ...wish, id: this.ids.next(), now }, calendar, held);

    await this.appointmentRepository.save(target);

    return target.id;
  }
}
