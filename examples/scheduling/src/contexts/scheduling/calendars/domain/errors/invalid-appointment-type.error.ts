import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/scheduling.codes';

export class InvalidAppointmentType extends DomainRefusal {
  readonly code = SchedulingCodes.InvalidAppointmentType;

  static forRule(rule: string) {
    return InvalidAppointmentType.refusal(`An appointment type ${rule}.`, { rule });
  }
}
