import type { Clock, FileStaging } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { UnknownAppointment } from '@/contexts/scheduling/calendars/domain/errors/unknown-appointment.error';
import type { AppointmentRepository } from '@/contexts/scheduling/calendars/domain/repositories/appointment.repository';
import { RemoveAppointmentDocumentCommand } from '@/contexts/scheduling/calendars/application/commands/remove-appointment-document/remove-appointment-document.command';

@CommandHandler(RemoveAppointmentDocumentCommand)
export class RemoveAppointmentDocumentHandler implements CommandHandler<RemoveAppointmentDocumentCommand> {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly staging: FileStaging,
    private readonly clock: Clock,
  ) {}

  async execute(command: RemoveAppointmentDocumentCommand): Promise<string> {
    const appointment = await this.appointmentRepository.findById(command.appointmentId);

    if (appointment === undefined) {
      throw UnknownAppointment.forAppointment(command.appointmentId);
    }

    const file = appointment.removeDocument(this.clock.now());

    await this.appointmentRepository.save(appointment);
    await this.staging.deleteAfterCommit(file.key);

    return appointment.id;
  }
}
