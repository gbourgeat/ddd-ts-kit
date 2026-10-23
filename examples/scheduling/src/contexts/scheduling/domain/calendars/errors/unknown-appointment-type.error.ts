import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/domain/errors/codes';

export class UnknownAppointmentType extends DomainRefusal {
  readonly code = SchedulingCodes.UnknownAppointmentType;

  static forAppointmentType(appointmentTypeId: string) {
    return UnknownAppointmentType.refusal(`The calendar offers no appointment type ${appointmentTypeId}.`, {
      appointmentTypeId,
    });
  }
}
