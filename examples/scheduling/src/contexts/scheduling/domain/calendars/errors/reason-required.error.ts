import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/domain/errors/codes';

export class ReasonRequired extends DomainRefusal {
  readonly code = SchedulingCodes.ReasonRequired;

  static onCancellation() {
    return ReasonRequired.refusal('The practice gives a reason when it cancels an appointment.');
  }
}
