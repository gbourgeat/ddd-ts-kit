import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/domain/errors/codes';

export class InvalidSlot extends DomainRefusal {
  readonly code = SchedulingCodes.InvalidSlot;

  static forRule(reason: string) {
    return InvalidSlot.refusal(`A slot ${reason}.`, { reason });
  }
}
