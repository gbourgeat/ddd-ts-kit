import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { UnknownAppointment } from '@/contexts/scheduling/calendars/domain/errors/unknown-appointment.error';
import type { AppointmentRepository } from '@/contexts/scheduling/calendars/domain/repositories/appointment.repository';
import { CompleteAppointmentCommand } from '@/contexts/scheduling/calendars/application/commands/complete-appointment/complete-appointment.command';

@CommandHandler(CompleteAppointmentCommand)
export class CompleteAppointmentHandler implements CommandHandler<CompleteAppointmentCommand> {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: CompleteAppointmentCommand): Promise<string> {
    const appointment = await this.appointmentRepository.findById(command.appointmentId);

    if (appointment === undefined) {
      throw UnknownAppointment.forAppointment(command.appointmentId);
    }

    appointment.complete(this.clock.now());

    await this.appointmentRepository.save(appointment);

    return appointment.id;
  }
}
