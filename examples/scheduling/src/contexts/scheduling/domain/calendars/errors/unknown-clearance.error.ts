import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/domain/errors/codes';

export class UnknownClearance extends DomainRefusal {
  readonly code = SchedulingCodes.UnknownClearance;

  static forClearance(clearanceId: string) {
    return UnknownClearance.refusal(`There is no clearance ${clearanceId}.`, { clearanceId });
  }
}
