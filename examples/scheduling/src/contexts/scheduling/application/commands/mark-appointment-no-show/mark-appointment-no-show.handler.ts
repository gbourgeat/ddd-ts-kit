import { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentNotFoundError } from '../../../domain/errors/appointment-not-found.error.js';
import { AppointmentRepository } from '../../../domain/repositories/appointment.repository.js';
import { MarkAppointmentNoShowCommand } from './mark-appointment-no-show.command.js';

@CommandHandler(MarkAppointmentNoShowCommand, [AppointmentRepository, Clock])
export class MarkAppointmentNoShowHandler implements CommandHandler<MarkAppointmentNoShowCommand> {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: MarkAppointmentNoShowCommand): Promise<string> {
    const target = await this.appointmentRepository.findById(command.appointmentId);

    if (target === undefined) {
      throw new AppointmentNotFoundError(command.appointmentId);
    }

    target.markNoShow(this.clock.now());

    await this.appointmentRepository.save(target);

    return target.id;
  }
}
