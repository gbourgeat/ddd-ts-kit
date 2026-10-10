import { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentNotFoundError } from '@/contexts/scheduling/domain/errors/appointment-not-found.error.js';
import { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository.js';
import { ConfirmAppointmentCommand } from '@/contexts/scheduling/application/commands/confirm-appointment/confirm-appointment.command.js';

@CommandHandler(ConfirmAppointmentCommand, [AppointmentRepository, Clock])
export class ConfirmAppointmentHandler implements CommandHandler<ConfirmAppointmentCommand> {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: ConfirmAppointmentCommand): Promise<string> {
    const target = await this.appointmentRepository.findById(command.appointmentId);

    if (target === undefined) {
      throw new AppointmentNotFoundError(command.appointmentId);
    }

    target.confirm(this.clock.now());

    await this.appointmentRepository.save(target);

    return target.id;
  }
}
