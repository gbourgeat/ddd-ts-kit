import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { IdentityCodes } from '@/contexts/identity/domain/errors/codes';

export class UnknownTimeZone extends DomainRefusal {
  readonly code = IdentityCodes.UnknownTimeZone;

  static forName(value: string) {
    return UnknownTimeZone.refusal(`"${value}" is not an IANA time zone.`, { value });
  }
}
