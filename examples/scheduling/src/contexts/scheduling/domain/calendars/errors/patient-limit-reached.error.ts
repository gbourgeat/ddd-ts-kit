import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/domain/errors/codes';

export class PatientLimitReached extends DomainRefusal {
  readonly code = SchedulingCodes.PatientLimitReached;

  static atLimit(limit: number) {
    return PatientLimitReached.refusal(
      `The patient already holds ${limit} future appointments with this practitioner.`,
      { limit },
    ).exposing('limit');
  }
}
