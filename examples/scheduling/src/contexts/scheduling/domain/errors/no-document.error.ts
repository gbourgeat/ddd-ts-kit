import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/domain/errors/codes';

export class NoDocument extends DomainRefusal {
  readonly code = SchedulingCodes.NoDocument;

  static forAppointment(appointmentId: string) {
    return NoDocument.refusal(`Appointment ${appointmentId} holds no document.`, {
      appointmentId,
    });
  }
}
