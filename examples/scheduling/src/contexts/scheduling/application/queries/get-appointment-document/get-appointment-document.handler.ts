import type { FileStorage } from '@ddd-ts-kit/kernel';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentError } from '@/contexts/scheduling/domain/errors/appointment.error';
import type { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';
import { GetAppointmentDocumentQuery } from '@/contexts/scheduling/application/queries/get-appointment-document/get-appointment-document.query';
import type { GetAppointmentDocumentResult } from '@/contexts/scheduling/application/queries/get-appointment-document/get-appointment-document.result';

/** Five minutes: long enough for a click, short enough that a link copied into a mail or a log soon grants nothing. */
const LINK_SECONDS = 300;

@QueryHandler(GetAppointmentDocumentQuery)
export class GetAppointmentDocumentHandler implements QueryHandler<GetAppointmentDocumentQuery> {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly files: FileStorage,
  ) {}

  async execute(query: GetAppointmentDocumentQuery): Promise<GetAppointmentDocumentResult> {
    const appointment = await this.appointmentRepository.findById(query.appointmentId);

    if (appointment === undefined) {
      throw AppointmentError.notFound(query.appointmentId);
    }

    const { document } = appointment;

    if (document === undefined) {
      throw AppointmentError.noDocument(appointment.id);
    }

    const { file, name } = document;
    const link = await this.files.signedDownloadUrl(file.key, { expiresInSeconds: LINK_SECONDS, fileName: name });

    return { url: link.url, expiresAt: link.expiresAt, name, mediaType: file.mediaType, size: file.size };
  }
}
