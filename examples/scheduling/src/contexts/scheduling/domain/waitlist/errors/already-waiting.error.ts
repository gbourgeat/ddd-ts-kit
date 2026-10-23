import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/scheduling.codes';

export class AlreadyWaiting extends DomainRefusal {
  readonly code = SchedulingCodes.AlreadyWaiting;

  static forPatient(patientId: string) {
    return AlreadyWaiting.refusal(`The patient ${patientId} is already on this waitlist.`, {
      patientId,
    });
  }
}
