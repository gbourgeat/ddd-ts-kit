import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { IdentityCodes } from '@/contexts/identity/domain/errors/codes';

export class DelegationEndsInThePast extends DomainRefusal {
  readonly code = IdentityCodes.DelegationEndsInThePast;

  static atEnd(endsAt: Date) {
    return DelegationEndsInThePast.refusal(`A delegation cannot end in the past (${endsAt.toISOString()}).`, {
      endsAt,
    }).exposing('endsAt');
  }
}
