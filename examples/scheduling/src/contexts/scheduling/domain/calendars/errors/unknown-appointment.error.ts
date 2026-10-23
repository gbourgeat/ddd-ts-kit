import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/domain/errors/codes';

export class UnknownAppointment extends DomainRefusal {
  readonly code = SchedulingCodes.UnknownAppointment;

  static forAppointment(appointmentId: string) {
    return UnknownAppointment.refusal(`Appointment ${appointmentId} does not exist.`, {
      appointmentId,
    });
  }
}
