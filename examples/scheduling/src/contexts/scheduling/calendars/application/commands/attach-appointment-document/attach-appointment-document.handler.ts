import { type Clock, type FileStaging } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { UnknownAppointment } from '@/contexts/scheduling/calendars/domain/errors/unknown-appointment.error';
import type { AppointmentRepository } from '@/contexts/scheduling/calendars/domain/repositories/appointment.repository';
import { AttachedDocument } from '@/contexts/scheduling/calendars/domain/value-objects/attached-document.vo';
import { AttachAppointmentDocumentCommand } from '@/contexts/scheduling/calendars/application/commands/attach-appointment-document/attach-appointment-document.command';

@CommandHandler(AttachAppointmentDocumentCommand)
export class AttachAppointmentDocumentHandler implements CommandHandler<AttachAppointmentDocumentCommand> {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly staging: FileStaging,
    private readonly clock: Clock,
  ) {}

  /** The file arrives staged and scanned; its reference is saved with the appointment and the file reaches its key with the commit; the file it replaces is deleted once committed. */
  async execute(command: AttachAppointmentDocumentCommand): Promise<string> {
    const appointment = await this.appointmentRepository.findById(command.appointmentId);

    if (appointment === undefined) {
      throw UnknownAppointment.forAppointment(command.appointmentId);
    }

    const { file, fileName } = command.document;
    const now = this.clock.now();
    const replaced = appointment.attachDocument(AttachedDocument.create(file, fileName, now), now);

    await this.appointmentRepository.save(appointment);
    await this.staging.promoteOnCommit(file.key);

    if (replaced !== undefined) {
      await this.staging.deleteAfterCommit(replaced.key);
    }

    return file.key;
  }
}
