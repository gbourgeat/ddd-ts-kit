import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { UnknownAppointment } from '@/contexts/scheduling/domain/calendars/errors/unknown-appointment.error';
import type { AppointmentRepository } from '@/contexts/scheduling/domain/calendars/repositories/appointment.repository';
import { MarkAppointmentNoShowCommand } from '@/contexts/scheduling/application/calendars/commands/mark-appointment-no-show/mark-appointment-no-show.command';

@CommandHandler(MarkAppointmentNoShowCommand)
export class MarkAppointmentNoShowHandler implements CommandHandler<MarkAppointmentNoShowCommand> {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: MarkAppointmentNoShowCommand): Promise<string> {
    const appointment = await this.appointmentRepository.findById(command.appointmentId);

    if (appointment === undefined) {
      throw UnknownAppointment.forAppointment(command.appointmentId);
    }

    appointment.markNoShow(this.clock.now());

    await this.appointmentRepository.save(appointment);

    return appointment.id;
  }
}
