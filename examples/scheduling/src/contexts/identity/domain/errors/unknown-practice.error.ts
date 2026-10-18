import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { IdentityCodes } from '@/contexts/identity/domain/errors/codes';

export class UnknownPractice extends DomainRefusal {
  readonly code = IdentityCodes.UnknownPractice;

  static forPractice(practiceId: string) {
    return UnknownPractice.refusal(`The practice ${practiceId} does not exist.`, { practiceId });
  }
}
