import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentError } from '@/contexts/scheduling/domain/errors/appointment.error';
import type { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';
import { MarkAppointmentNoShowCommand } from '@/contexts/scheduling/application/commands/mark-appointment-no-show/mark-appointment-no-show.command';

@CommandHandler(MarkAppointmentNoShowCommand)
export class MarkAppointmentNoShowHandler implements CommandHandler<MarkAppointmentNoShowCommand> {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: MarkAppointmentNoShowCommand): Promise<string> {
    const target = await this.appointmentRepository.findById(command.appointmentId);

    if (target === undefined) {
      throw AppointmentError.notFound(command.appointmentId);
    }

    target.markNoShow(this.clock.now());

    await this.appointmentRepository.save(target);

    return target.id;
  }
}
