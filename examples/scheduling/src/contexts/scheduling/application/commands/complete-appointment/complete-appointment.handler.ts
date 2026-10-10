import { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentNotFoundError } from '@/contexts/scheduling/domain/errors/appointment-not-found.error.js';
import { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository.js';
import { CompleteAppointmentCommand } from '@/contexts/scheduling/application/commands/complete-appointment/complete-appointment.command.js';

@CommandHandler(CompleteAppointmentCommand, [AppointmentRepository, Clock])
export class CompleteAppointmentHandler implements CommandHandler<CompleteAppointmentCommand> {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: CompleteAppointmentCommand): Promise<string> {
    const target = await this.appointmentRepository.findById(command.appointmentId);

    if (target === undefined) {
      throw new AppointmentNotFoundError(command.appointmentId);
    }

    target.complete(this.clock.now());

    await this.appointmentRepository.save(target);

    return target.id;
  }
}
