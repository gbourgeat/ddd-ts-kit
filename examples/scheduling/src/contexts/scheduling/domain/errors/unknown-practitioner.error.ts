import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/domain/errors/codes';

export class UnknownPractitioner extends DomainRefusal {
  readonly code = SchedulingCodes.UnknownPractitioner;

  static atPractice(practiceId: string, practitionerId: string) {
    return UnknownPractitioner.refusal(
      `The person ${practitionerId} is not a practitioner of the practice ${practiceId}.`,
      { practiceId, practitionerId },
    );
  }
}
