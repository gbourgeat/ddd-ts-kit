import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/domain/errors/codes{{alias.ext}}';

export class InvalidEmailAddress extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.InvalidEmailAddress;

  static forValue(raw: string) {
    return InvalidEmailAddress.refusal('An email address is a local part, an @ and a domain.', { raw });
  }
}
