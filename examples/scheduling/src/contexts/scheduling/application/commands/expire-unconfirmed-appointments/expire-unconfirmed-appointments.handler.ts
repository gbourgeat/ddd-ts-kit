import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';
import { ExpireUnconfirmedAppointmentsCommand } from '@/contexts/scheduling/application/commands/expire-unconfirmed-appointments/expire-unconfirmed-appointments.command';

@CommandHandler(ExpireUnconfirmedAppointmentsCommand, [AppointmentRepository])
export class ExpireUnconfirmedAppointmentsHandler implements CommandHandler<ExpireUnconfirmedAppointmentsCommand> {
  constructor(private readonly appointmentRepository: AppointmentRepository) {}

  /** Safe to repeat: an appointment that expired is no longer among the unconfirmed ones. */
  async execute(command: ExpireUnconfirmedAppointmentsCommand): Promise<void> {
    const due = await this.appointmentRepository.unconfirmedAt(command.at);

    for (const target of due) {
      target.expire(command.at);

      await this.appointmentRepository.save(target);
    }
  }
}
