import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/domain/errors/codes{{alias.ext}}';

export class InvalidOrganisationName extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.InvalidOrganisationName;

  static forValue(raw: string) {
    return InvalidOrganisationName.refusal('The name of an organisation holds between 1 and 100 characters.', { raw });
  }
}
