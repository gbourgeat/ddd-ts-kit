import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/scheduling.codes';

export class AlreadyNoted extends DomainRefusal {
  readonly code = SchedulingCodes.AlreadyNoted;

  static forAppointment(appointmentId: string) {
    return AlreadyNoted.refusal(`The appointment ${appointmentId} is already noted in this attendance record.`, {
      appointmentId,
    });
  }
}
