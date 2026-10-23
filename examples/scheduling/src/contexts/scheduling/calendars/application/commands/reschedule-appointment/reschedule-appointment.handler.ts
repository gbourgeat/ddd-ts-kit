import { Access } from '@ddd-ts-kit/auth';
import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { UnknownAppointment } from '@/contexts/scheduling/calendars/domain/errors/unknown-appointment.error';
import { UnknownCalendar } from '@/contexts/scheduling/calendars/domain/errors/unknown-calendar.error';
import type { AppointmentRepository } from '@/contexts/scheduling/calendars/domain/repositories/appointment.repository';
import type { CalendarRepository } from '@/contexts/scheduling/calendars/domain/repositories/calendar.repository';
import { SchedulerService } from '@/contexts/scheduling/calendars/domain/services/scheduler.service';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';
import { RescheduleAppointmentCommand } from '@/contexts/scheduling/calendars/application/commands/reschedule-appointment/reschedule-appointment.command';

/** An appointment and its buffer never last a day: what could overlap a slot is held within a day of its start. */
const DAY = 24 * 60 * 60_000;

@CommandHandler(RescheduleAppointmentCommand)
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
    const appointment = await this.appointmentRepository.findById(appointmentId);

    if (appointment === undefined) {
      throw UnknownAppointment.forAppointment(appointmentId);
    }

    await this.access.authorize(actor, schedulingPermissions['appointment.reschedule'], appointment);

    const calendar = await this.calendarRepository.findById(appointment.calendarId);

    if (calendar === undefined) {
      throw UnknownCalendar.forCalendar(appointment.calendarId);
    }

    const now = this.clock.now();

    const held = {
      onCalendar: await this.appointmentRepository.heldOn(
        calendar.id,
        new Date(startsAt.getTime() - DAY),
        new Date(startsAt.getTime() + DAY),
      ),
      byPatient: await this.appointmentRepository.heldBy(appointment.patientId, calendar.practitionerId, now),
    };

    this.scheduler.reschedule({ appointment: appointment, startsAt, now }, calendar, held);

    await this.appointmentRepository.save(appointment);

    return appointment.id;
  }
}
