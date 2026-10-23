import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/scheduling.codes';

export class TimeOffCoversAppointments extends DomainRefusal {
  readonly code = SchedulingCodes.TimeOffCoversAppointments;

  static withCount(held: number) {
    return TimeOffCoversAppointments.refusal(`The time off covers ${held} active appointment(s).`, {
      held,
    }).exposing('held');
  }
}
