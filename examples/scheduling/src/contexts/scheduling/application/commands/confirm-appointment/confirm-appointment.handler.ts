import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentError } from '@/contexts/scheduling/domain/errors/appointment.error';
import type { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';
import { ConfirmAppointmentCommand } from '@/contexts/scheduling/application/commands/confirm-appointment/confirm-appointment.command';

@CommandHandler(ConfirmAppointmentCommand)
export class ConfirmAppointmentHandler implements CommandHandler<ConfirmAppointmentCommand> {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: ConfirmAppointmentCommand): Promise<string> {
    const appointment = await this.appointmentRepository.findById(command.appointmentId);

    if (appointment === undefined) {
      throw AppointmentError.notFound(command.appointmentId);
    }

    appointment.confirm(this.clock.now());

    await this.appointmentRepository.save(appointment);

    return appointment.id;
  }
}
