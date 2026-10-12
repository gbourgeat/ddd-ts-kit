import { Access } from '@ddd-ts-kit/auth';
import { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentNotFoundError } from '@/contexts/scheduling/domain/errors/appointment-not-found.error';
import { UnknownCalendarError } from '@/contexts/scheduling/domain/errors/unknown-calendar.error';
import { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';
import { CalendarRepository } from '@/contexts/scheduling/domain/repositories/calendar.repository';
import { SchedulerService } from '@/contexts/scheduling/domain/services/scheduler.service';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { RescheduleAppointmentCommand } from '@/contexts/scheduling/application/commands/reschedule-appointment/reschedule-appointment.command';

/** An appointment and its buffer never last a day: what could overlap a slot is held within a day of its start. */
const DAY = 24 * 60 * 60_000;

@CommandHandler(RescheduleAppointmentCommand, [AppointmentRepository, CalendarRepository, Access, Clock])
export class RescheduleAppointmentHandler implements CommandHandler<RescheduleAppointmentCommand> {
  private readonly scheduler = new SchedulerService();

  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly calendarRepository: CalendarRepository,
    private readonly access: Access,
    private readonly clock: Clock,
  ) {}

  /** One change of one aggregate: the patient is never left without a slot or with two. */
  async execute({ actor, appointmentId, startsAt }: RescheduleAppointmentCommand): Promise<string> {
    const target = await this.appointmentRepository.findById(appointmentId);

    if (target === undefined) {
      throw new AppointmentNotFoundError(appointmentId);
    }

    await this.access.authorize(actor, schedulingPermissions['appointment.reschedule'], target);

    const calendar = await this.calendarRepository.findById(target.calendarId);

    if (calendar === undefined) {
      throw new UnknownCalendarError(target.calendarId);
    }

    const now = this.clock.now();

    const held = {
      onCalendar: await this.appointmentRepository.heldOn(
        calendar.id,
        new Date(startsAt.getTime() - DAY),
        new Date(startsAt.getTime() + DAY),
      ),
      byPatient: await this.appointmentRepository.heldBy(target.patientId, calendar.practitionerId, now),
    };

    this.scheduler.reschedule({ appointment: target, startsAt, now }, calendar, held);

    await this.appointmentRepository.save(target);

    return target.id;
  }
}
